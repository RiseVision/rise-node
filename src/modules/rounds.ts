import { IDatabase, ITask } from 'pg-promise';
import roundsSQL from '../../sql/logic/rounds';
import { Bus, constants, ILogger, Slots } from '../helpers/';
import { RoundLogic, RoundLogicScope, SignedBlockType } from '../logic/';
import { AppConfig } from '../types/genericTypes';
import { address, publicKey } from '../types/sanityTypes';
import { AccountsModule } from './accounts';
import { DelegatesModule } from './delegates';

// tslint:disable-next-line
export type RoundsLibrary = {
  logger: ILogger,
  db: IDatabase<any>,
  bus: Bus,
  io: SocketIO.Server,
  config: AppConfig
};

export class RoundsModule {
  private loaded: boolean  = false;
  private ticking: boolean = false;

  private modules: { delegates: DelegatesModule, accounts: AccountsModule };

  constructor(private library: RoundsLibrary) {
  }

  public isLoaded() {
    return this.loaded;
  }

  public isTicking() {
    return this.ticking;
  }

  public onBind(scope: { accounts: AccountsModule, delegates: any }) {
    this.modules = {
      accounts : scope.accounts,
      delegates: scope.delegates,
    };
  }

  public onFinishRound(round: number) {
    this.library.io.sockets.emit('rounds/change', { number: round });
  }

  public onBlockchainReady() {
    this.loaded = true;
  }

  public cleanup() {
    this.loaded = false;
    return Promise.resolve();
  }

  /**
   * Sets the snapshot rounds
   */
  public setSnapshotRounds(rounds: number) {
    this.library.config.loading.snapshot = rounds;
  }

  /**
   * Return round calculated given the blockheight
   * @return {number}
   */
  public calcRound(height: number) {
    return Math.ceil(height / Slots.delegates);
  }

  /**
   * Gets inclusive range of round from given height
   */
  public heightFromRound(round: number): { first: number, last: number } {
    return {
      first: round * Slots.delegates + 1,
      last : (round + 1) * Slots.delegates,
    };
  }

  /**
   * Deletes specific round from mem_rounds table
   */
  public flush(round: number) {
    return this.library.db.none(roundsSQL.flush, { round })
      .catch((err) => {
        this.library.logger.error(err.stack);
        return Promise.reject(new Error('Rounds#flush error'));
      });
  }

  /**
   * Performs a backward tick on the round
   * @param {SignedBlockType} block
   * @param {SignedBlockType} previousBlock
   */
  public backwardTick(block: SignedBlockType, previousBlock: SignedBlockType) {
    return this.innerTick(block, true, (roundLogicScope) => (task) => {
      this.library.logger.debug('Performing backward tick');
      this.library.logger.trace(roundLogicScope);

      const roundLogic = new RoundLogic(roundLogicScope, task);

      return roundLogic.mergeBlockGenerator()
      // call backwardLand only if this was the last block in round.
        .then(() => roundLogicScope.finishRound ? roundLogic.backwardLand() : null)
        .then(() => roundLogic.markBlockId());
    });
  }

  public async tick(block: SignedBlockType) {
    let finishSnapshot = false;
    return this.innerTick(
      block,
      false,
      (roundLogicScope) => (task) => {

        this.library.logger.debug('Performing forward tick');
        this.library.logger.trace(roundLogicScope);

        const roundLogic    = new RoundLogic(roundLogicScope, task);
        const snapshotRound = (
          this.library.config.loading.snapshot > 0 && this.library.config.loading.snapshot === roundLogicScope.round
        );

        return roundLogic.mergeBlockGenerator()
        // call land only if this was the last block in round.
          .then(() => roundLogicScope.finishRound
            ? roundLogic.land()
              .then(() => this.library.bus.message('finishRound', roundLogicScope.round))

              // If this was the round of the snapshot lets truncate the blocks
              .then(() => snapshotRound
                ? roundLogic.truncateBlocks()
                  .then(() => finishSnapshot = true)
                : null
              )
            : null
          )
          .then(() => roundLogic.markBlockId());
      },
      async () => {
        // Check if we are one block before last block of round, if yes - perform round snapshot
        // TODO: Check either logic or comment one of the 2 seems off.
        if ((block.height + 1) % Slots.delegates === 0) {
          this.library.logger.debug('Performing round snapshot...');

          await this.library.db.tx((t) => t.batch([
              t.none(roundsSQL.clearRoundSnapshot),
              t.none(roundsSQL.performRoundSnapshot),
              t.none(roundsSQL.clearVotesSnapshot),
              t.none(roundsSQL.performVotesSnapshot),
            ])
          ).catch((err) => {
            this.library.logger.error('Round snapshot failed', err);
            return Promise.reject(err);
          });

          this.library.logger.trace('Round snapshot done');
        }
      });
  }

  private async innerTick(block: SignedBlockType,
                          backwards: boolean,
                          txGenerator: (ls: RoundLogicScope) => (t: ITask<any>) => Promise<any>,
                          afterTxPromise: () => Promise<any> = () => Promise.resolve(null)) {
    const round     = this.calcRound(block.height);
    const nextRound = this.calcRound(block.height + 1);

    const finishRound = (
      (nextRound !== round) || (block.height === 1 || block.height === 101)
    );

    try {
      // Set ticking flag to true
      this.ticking = true;

      const roundSums      = finishRound ? await this.sumRound(round) : null;
      const roundOutsiders = finishRound ? await this.getOutsiders(round, roundSums.roundDelegates) : null;

      const roundLogicScope: RoundLogicScope = {
        backwards,
        block  : block as any, // TODO: ID and height are optional in SignedBlockType
        finishRound,
        library: this.library,
        modules: this.modules,
        round,
        roundOutsiders,
        ...roundSums,
      };
      await this.library.db.tx(txGenerator(roundLogicScope));
      await afterTxPromise();
    } catch (e) {
      this.library.logger.warn('Error while doing modules.rounds.backwardTick', e.message || e);
    } finally {
      this.ticking = false;
    }
  }

  /**
   * Generates outsider array from a given round and roundDelegates (the ones who actually forged something)
   * @return {Promise<address[]>} a list of addresses that missed the blocks
   */
  private async getOutsiders(round: number, roundDelegates: publicKey[]): Promise<address[]> {

    const { last: height }  = this.heightFromRound(round);
    const originalDelegates = await this.modules.delegates.generateDelegateList(height);

    return originalDelegates
      .filter((pk) => roundDelegates.indexOf(pk) === -1)
      .map((pk) => this.modules.accounts.generateAddressByPublicKey(pk));
  }

  // tslint:disable-next-line
  private async sumRound(round: number): Promise<{ roundFees: number, roundRewards: number[], roundDelegates: publicKey[] }> {
    this.library.logger.debug('Summing round', round);
    const rows = await this.library.db.query(
      roundsSQL.summedRound,
      {
        activeDelegates: constants.activeDelegates,
        round,
      }
    )
      .catch((err) => {
        this.library.logger.error('Failed to sum round', round);
        this.library.logger.error(err.stack);
        return Promise.reject(err);
      });

    const roundRewards   = rows[0].rewards.map((reward) => Math.floor(reward));
    const roundFees      = Math.floor(rows[0].fees);
    const roundDelegates = rows[0].delegates;

    return { roundRewards, roundFees, roundDelegates };
  }

}
