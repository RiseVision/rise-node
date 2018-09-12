import { inject, injectable } from 'inversify';
import { Transaction } from 'sequelize';
import SocketIO from 'socket.io';
import { Bus, constants as constantsType, DBHelper, ILogger, Slots } from '../helpers/';
import { IAppState, IRoundLogicNewable, IRoundsLogic } from '../ioc/interfaces/logic/';
import { IAccountsModule, IDelegatesModule, IRoundsModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { RoundLogicScope, SignedBlockType } from '../logic/';
import { AccountsModel, BlocksModel, RoundsModel } from '../models';
import roundsSQL from '../sql/logic/rounds';
import { DBOp } from '../types/genericTypes';
import { address } from '../types/sanityTypes';

@injectable()
export class RoundsModule implements IRoundsModule {

  // Helpers and generics
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.helpers.db)
  private dbHelper: DBHelper;
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

  // models
  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.blocks)
  private BlocksModel: typeof BlocksModel;
  @inject(Symbols.models.rounds)
  private RoundsModel: typeof RoundsModel;

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
   * Performs a backward tick on the round
   * @param {SignedBlockType} block
   * @param {SignedBlockType} previousBlock
   * @param {Transaction} transaction
   */
  public backwardTick(block: BlocksModel, previousBlock: SignedBlockType, transaction: Transaction) {
    return this.innerTick(block,  transaction, true, async (roundLogicScope) => {
      this.logger.debug('Performing backward tick');

      const roundLogic            = new this.RoundLogic(roundLogicScope, this.slots);
      const ops: Array<DBOp<any>> = [...roundLogic.mergeBlockGenerator()];
      if (roundLogicScope.finishRound) {
        // call backwardLand only if this was the last block in round.
        ops.push(... roundLogic.backwardLand());
      }
      ops.push(roundLogic.markBlockId());
      return this.dbHelper.performOps(ops, transaction);
    });
  }

  public async tick(block: SignedBlockType, transaction: Transaction) {
    return this.innerTick(
      block,
      transaction,
      false,
      async (roundLogicScope) => {
        this.logger.debug('Performing forward tick');
        const roundLogic            = new this.RoundLogic(roundLogicScope, this.slots);
        const snapshotRound         = (
          this.getSnapshotRounds() > 0 && this.getSnapshotRounds() === roundLogicScope.round
        );
        const ops: Array<DBOp<any>> = [...roundLogic.mergeBlockGenerator()];
        if (roundLogicScope.finishRound) {
          ops.push(... roundLogic.land());
          if (snapshotRound) {
            ops.push(roundLogic.truncateBlocks());
          }
        }
        ops.push(roundLogic.markBlockId());
        await this.dbHelper.performOps(ops, transaction);
        if (roundLogicScope.finishRound) {
          await this.bus.message('finishRound', roundLogicScope.round);
        }
      },
      async () => {
        // Check if we are one block before last block of round, if yes - perform round snapshot
        // TODO: Check either logic or comment one of the 2 seems off.
        if ((block.height + 1) % this.slots.numDelegates(block.height) === 0) {
          this.logger.debug('Performing round snapshot...');

          await this.dbHelper.performOps([
              roundsSQL.clearRoundSnapshot,
              roundsSQL.performRoundSnapshot,
              roundsSQL.clearVotesSnapshot,
              roundsSQL.performVotesSnapshot,
            ].map<DBOp<any>>((query) => ({ model: this.RoundsModel, query, type: 'custom' })),
            transaction);

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
                          dbTransaction: Transaction,
                          backwards: boolean,
                          txGenerator: (ls: RoundLogicScope) => Promise<any>,
                          afterTxPromise: () => Promise<any> = () => Promise.resolve(null)) {
    const round     = this.roundsLogic.calcRound(block.height);
    const nextRound = this.roundsLogic.calcRound(block.height + 1);

    const finishRound = (
      (nextRound !== round) || (block.height === 1)
    );
    try {
      // Set ticking flag to true
      this.appStateLogic.set('rounds.isTicking', true);
      let roundSums = finishRound ? await this.sumRound(round, dbTransaction) : null;
      if (block.height === 1 && roundSums.roundDelegates.length !== 1) {
        // in round 1 (and height=1) and when verifying snapshot delegates are there (and created in 2nd round #1)
        // so roundDelegates are 101 not 1 (genesis generator) causing genesis to have an extra block accounted.
        // so we fix this glitch by monkeypatching the value and set roundDelegates to the correct genesis generator.
        roundSums = { roundFees: 0, roundRewards: [0], roundDelegates: [block.generatorPublicKey] };
      }

      const roundOutsiders = finishRound ? await this.getOutsiders(round, roundSums.roundDelegates) : null;

      const roundLogicScope: RoundLogicScope = {
        backwards,
        block,
        finishRound,
        library: {
          logger: this.logger,
        },
        models: {
          AccountsModel: this.AccountsModel,
          BlocksModel: this.BlocksModel,
          RoundsModel: this.RoundsModel,
        },
        modules: {
          accounts: this.accountsModule,
        },
        round,
        roundOutsiders,
        ...roundSums,
      };
      await txGenerator(roundLogicScope);
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

    const height            = this.roundsLogic.lastInRound(round);
    const originalDelegates = await this.delegatesModule.generateDelegateList(height);

    return originalDelegates
      .filter((pk) => strPKDelegates.indexOf(pk.toString('hex')) === -1)
      .map((pk) => this.accountsModule.generateAddressByPublicKey(pk));
  }

  // tslint:disable-next-line
  private async sumRound(round: number, tx: Transaction): Promise<{ roundFees: number, roundRewards: number[], roundDelegates: Buffer[] }> {
    this.logger.debug('Summing round', round);
    const firstBlockHeight = this.roundsLogic.firstInRound(round);
    const res = await this.RoundsModel.sumRound(this.slots.numDelegates(firstBlockHeight), round, tx);

    const roundRewards   = res.rewards.map((reward) => Math.floor(parseFloat(reward)));
    const roundFees      = Math.floor(parseFloat(res.fees));
    const roundDelegates = res.delegates;

    return { roundRewards, roundFees, roundDelegates };
  }

}
