import { inject, injectable } from 'inversify';
import { IDatabase, ITask } from 'pg-promise';
import SocketIO from 'socket.io';
import { Bus, constants as constantsType, ILogger, Slots } from '../helpers/';
import { IAppState, IRoundLogicNewable, IRoundsLogic } from '../ioc/interfaces/logic/';
import { IAccountsModule, IDelegatesModule, IRoundsModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { RoundLogicScope, SignedBlockType } from '../logic/';
import { BlocksModel, RoundsModel } from '../models';
import roundsSQL from '../sql/logic/rounds';
import { address } from '../types/sanityTypes';


@injectable()
export class RoundsModule implements IRoundsModule {

  // Helpers and generics
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.slots)
  private slots: Slots;

  // Logic
  @inject(Symbols.logic.appState)
  private appStateLogic: IAppState;
  @inject(Symbols.logic.round)
  private RoundLogic: IRoundLogicNewable;
  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  // modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;

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
  public backwardTick(block: BlocksModel, previousBlock: SignedBlockType) {
    return this.innerTick(block, true, (roundLogicScope) => (task) => {
      this.logger.debug('Performing backward tick');

      const roundLogic = new this.RoundLogic(roundLogicScope, task, this.slots);

      return roundLogic.mergeBlockGenerator()
      // call backwardLand only if this was the last block in round.
        .then(() => roundLogicScope.finishRound ? roundLogic.backwardLand() : null)
        .then(() => roundLogic.markBlockId());
    });
  }

  public async tick(block: SignedBlockType) {
    return this.innerTick(
      block,
      false,
      (roundLogicScope) => (task) => {

        this.logger.debug('Performing forward tick');
        const roundLogic    = new this.RoundLogic(roundLogicScope, task, this.slots);
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
      (nextRound !== round) || (block.height === 1)
    );
    // if (finishRound) {
    //   console.log('finishround', block.height);
    // }
    try {
      // Set ticking flag to true
      this.appStateLogic.set('rounds.isTicking', true);
      let roundSums      = finishRound ? await this.sumRound(round) : null;
      if (block.height === 1 && roundSums.roundDelegates.length !== 1) {
        // in round 1 (and height=1) and when verifying snapshot delegates are there (and created in 2nd round #1)
        // so roundDelegates are 101 not 1 (genesis generator) causing genesis to have an extra block accounted.
        // so we fix this glitch by monkeypatching the value and set roundDelegates to the correct genesis generator.
        roundSums = { roundFees: 0, roundRewards: [0], roundDelegates: [block.generatorPublicKey] };
      }

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
      this.appStateLogic.set('rounds.isTicking', false);
    } catch (e) {
      this.logger.warn(`Error while doing modules.innerTick [backwards=${backwards}]`, e.message || e);
      this.appStateLogic.set('rounds.isTicking', false);
      throw e;
    }
  }

  /**
   * Generates outsider array from a given round and roundDelegates (the ones who actually forged something)
   * @return {Promise<address[]>} a list of addresses that missed the blocks
   */
  private async getOutsiders(round: number, roundDelegates: Buffer[]): Promise<address[]> {
    const strPKDelegates = roundDelegates.map((r) => r.toString('hex'));

    const height  = this.roundsLogic.lastInRound(round);
    const originalDelegates = await this.delegatesModule.generateDelegateList(height);

    return originalDelegates
      .filter((pk) => strPKDelegates.indexOf(pk.toString('hex')) === -1)
      .map((pk) => this.accountsModule.generateAddressByPublicKey(pk));
  }

  // tslint:disable-next-line
  private async sumRound(round: number): Promise<{ roundFees: number, roundRewards: number[], roundDelegates: Buffer[] }> {
    this.logger.debug('Summing round', round);
    const res = await RoundsModel.sumRound(this.constants.activeDelegates, round);

    const roundRewards   = res.rewards.map((reward) => Math.floor(parseFloat(reward)));
    const roundFees      = Math.floor(parseFloat(res.fees));
    const roundDelegates = res.delegates;

    return { roundRewards, roundFees, roundDelegates };
  }

}
