import { inject, injectable } from 'inversify';
import { IDatabase, ITask } from 'pg-promise';
import { Bus, constants, ILogger, Slots } from '../helpers/';
import { IAppState, IRoundsLogic } from '../ioc/interfaces/logic/';
import { IAccountsModule, IDelegatesModule, IRoundsModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { RoundLogic, RoundLogicScope, SignedBlockType } from '../logic/';
import roundsSQL from '../sql/logic/rounds';
import { address, publicKey } from '../types/sanityTypes';

@injectable()
export class RoundsModule implements IRoundsModule {

  // modules
  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;

  // Helpers and generics
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.slots)
  private slots: Slots;
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;

  // Logic
  @inject(Symbols.logic.appState)
  private appStateLogic: IAppState;
  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  public onFinishRound(round: number) {
    this.io.sockets.emit('rounds/change', { number: round });
  }

  public onBlockchainReady() {
    this.appStateLogic.set('rounds.isLoaded', true);
  }

  public cleanup() {
    this.appStateLogic.set('rounds.isLoaded', false);
    return Promise.resolve();
  }

  /**
   * Deletes specific round from mem_rounds table
   */
  public flush(round: number): Promise<void> {
    return this.db.none(roundsSQL.flush, { round })
      .catch((err) => {
        this.logger.error(err.stack);
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
      this.logger.debug('Performing backward tick');
      this.logger.trace(roundLogicScope);

      const roundLogic = new RoundLogic(roundLogicScope, task, this.slots);

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

        this.logger.debug('Performing forward tick');
        this.logger.trace(roundLogicScope);

        const roundLogic    = new RoundLogic(roundLogicScope, task, this.slots);
        const snapshotRound = (
          this.getSnapshotRounds() > 0 && this.getSnapshotRounds() === roundLogicScope.round
        );

        return roundLogic.mergeBlockGenerator()
        // call land only if this was the last block in round.
          .then(() => roundLogicScope.finishRound
            ? roundLogic.land()
              .then(() => this.bus.message('finishRound', roundLogicScope.round))

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
        if ((block.height + 1) % this.slots.delegates === 0) {
          this.logger.debug('Performing round snapshot...');

          await this.db.tx((t) => t.batch([
              t.none(roundsSQL.clearRoundSnapshot),
              t.none(roundsSQL.performRoundSnapshot),
              t.none(roundsSQL.clearVotesSnapshot),
              t.none(roundsSQL.performVotesSnapshot),
            ])
          ).catch((err) => {
            this.logger.error('Round snapshot failed', err);
            return Promise.reject(err);
          });

          this.logger.trace('Round snapshot done');
        }
      });
  }

  /**
   * gets the snapshot rounds
   */
  private getSnapshotRounds() {
    return this.appStateLogic.get('rounds.snapshot') || 0;
  }

  private async innerTick(block: SignedBlockType,
                          backwards: boolean,
                          txGenerator: (ls: RoundLogicScope) => (t: ITask<any>) => Promise<any>,
                          afterTxPromise: () => Promise<any> = () => Promise.resolve(null)) {
    const round     = this.roundsLogic.calcRound(block.height);
    const nextRound = this.roundsLogic.calcRound(block.height + 1);

    const finishRound = (
      (nextRound !== round) || (block.height === 1 || block.height === 101)
    );

    try {
      // Set ticking flag to true
      this.appStateLogic.set('rounds.isTicking', true);

      const roundSums      = finishRound ? await this.sumRound(round) : null;
      const roundOutsiders = finishRound ? await this.getOutsiders(round, roundSums.roundDelegates) : null;

      const roundLogicScope: RoundLogicScope = {
        backwards,
        block  : block as any, // TODO: ID and height are optional in SignedBlockType
        finishRound,
        library: {
          logger: this.logger,
        },
        modules: {
          accounts: this.accountsModule,
        },
        round,
        roundOutsiders,
        ...roundSums,
      };
      await this.db.tx(txGenerator(roundLogicScope));
      await afterTxPromise();
    } catch (e) {
      this.logger.warn('Error while doing modules.rounds.backwardTick', e.message || e);
    } finally {
      this.appStateLogic.set('rounds.isTicking', false);
    }
  }

  /**
   * Generates outsider array from a given round and roundDelegates (the ones who actually forged something)
   * @return {Promise<address[]>} a list of addresses that missed the blocks
   */
  private async getOutsiders(round: number, roundDelegates: publicKey[]): Promise<address[]> {

    const height  = this.roundsLogic.lastInRound(round);
    const originalDelegates = await this.delegatesModule.generateDelegateList(height);

    return originalDelegates
      .filter((pk) => roundDelegates.indexOf(pk) === -1)
      .map((pk) => this.accountsModule.generateAddressByPublicKey(pk));
  }

  // tslint:disable-next-line
  private async sumRound(round: number): Promise<{ roundFees: number, roundRewards: number[], roundDelegates: publicKey[] }> {
    this.logger.debug('Summing round', round);
    const rows = await this.db.query(
      roundsSQL.summedRound,
      {
        activeDelegates: constants.activeDelegates,
        round,
      }
    )
      .catch((err) => {
        this.logger.error('Failed to sum round', round);
        this.logger.error(err.stack);
        return Promise.reject(err);
      });

    const roundRewards   = rows[0].rewards.map((reward) => Math.floor(reward));
    const roundFees      = Math.floor(rows[0].fees);
    const roundDelegates = rows[0].delegates;

    return { roundRewards, roundFees, roundDelegates };
  }

}
