import { OnCheckIntegrity, SnapshotBlocksCountFilter, UtilsCommonHeightList } from '@risevision/core';
import {
  IAccountsModel,
  IAccountsModule,
  IAppState,
  IBlocksModel,
  IDBHelper,
  ILogger,
  Symbols
} from '@risevision/core-interfaces';
import { address, AppConfig, DBOp, SignedBlockType } from '@risevision/core-types';
import * as fs from 'fs';
import { decorate, inject, injectable, named } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { Transaction } from 'sequelize';
import SocketIO from 'socket.io';
import { DposConstantsType, dPoSSymbols, RoundChanges, Slots } from '../helpers';
import { IRoundLogicNewable, RoundLogicScope } from '../logic/round';
import { RoundsLogic } from '../logic/rounds';
import { AccountsModelForDPOS, RoundsModel } from '../models/';
import { DelegatesModule } from './delegates';
import { ModelSymbols } from '@risevision/core-models';

const performRoundSnapshotSQL = fs.readFileSync(
  `${__dirname}/../../sql/performRoundSnapshot.sql`,
  { encoding: 'utf8' }
);
const Extended = WPHooksSubscriber(Object);
decorate(injectable(), Extended);

@injectable()
export class RoundsModule extends Extended {
  @inject(dPoSSymbols.helpers.roundChanges)
  private RoundChanges: typeof RoundChanges;

  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  // Helpers and generics
  @inject(Symbols.generic.constants)
  private constants: DposConstantsType;
  @inject(Symbols.helpers.db)
  private dbHelper: IDBHelper;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(dPoSSymbols.helpers.slots)
  private slots: Slots;

  // Logic
  @inject(Symbols.logic.appState)
  private appStateLogic: IAppState;
  @inject(dPoSSymbols.logic.round)
  private RoundLogic: IRoundLogicNewable;
  @inject(dPoSSymbols.logic.rounds)
  private roundsLogic: RoundsLogic;

  // modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule<AccountsModelForDPOS>;
  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;

  // models
  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.rounds)
  private RoundsModel: typeof RoundsModel;

  /**
   * Performs a backward tick on the round
   * @param {SignedBlockType} block
   * @param {SignedBlockType} previousBlock
   * @param {Transaction} transaction
   */
  public backwardTick(block: IBlocksModel, previousBlock: SignedBlockType, transaction: Transaction) {
    return this.innerTick(block, transaction, true, async (roundLogicScope) => {
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
          // TODO:
          // await this.bus.message('finishRound', roundLogicScope.round);
        }
      },
      async () => {
        // Check if we are one block before last block of round, if yes - perform round snapshot
        // TODO: Check either logic or comment one of the 2 seems off.
        if ((block.height + 1) % this.slots.delegates === 0) {
          this.logger.debug('Performing round snapshot...');
          await this.dbHelper.performOps(
            [{
              model: this.RoundsModel,
              query: performRoundSnapshotSQL,
              type : 'custom',
            }],
            transaction
          );
          this.logger.trace('Round snapshot done');
        }
      });
  }

  @OnCheckIntegrity()
  private async checkLoadingIntegrity(totalBlocks: number) {
    const round     = this.roundsLogic.calcRound(totalBlocks);
    const rounds    = await this.RoundsModel.findAll({ attributes: ['round'], group: 'round' });
    const unapplied = rounds.filter((r) => r.round !== round);
    if (unapplied.length > 0) {
      // round is not applied.
      throw new Error('Detected unapplied rounds in mem_round');
    }
  }

  @UtilsCommonHeightList()
  private async commonHeightList(heights: number[], height: number): Promise<number[]> {
    // Get IDs of first blocks of (n) last rounds, descending order
    // EXAMPLE: For height 2000000 (round 19802) we will get IDs of blocks at height: 1999902, 1999801, 1999700,
    // 1999599, 1999498
    const firstInRound             = this.roundsLogic.firstInRound(this.roundsLogic.calcRound(height));
    const heightsToQuery: number[] = [];
    for (let i = 0; i < 5; i++) {
      heightsToQuery.push(firstInRound - this.constants.activeDelegates * i);
    }
    return heightsToQuery;
  }

  @SnapshotBlocksCountFilter()
  private async snapshotBlockCount(blocksCount: number) {
    const round = this.roundsLogic.calcRound(blocksCount) - 1;
    if (typeof(this.appConfig.loading.snapshot) === 'boolean') {
      // threat "true" as "highest round possible"
      this.appConfig.loading.snapshot = round;
    }
    if (this.appConfig.loading.snapshot >= round) {
      this.appConfig.loading.snapshot = round;
      if (blocksCount % this.constants.activeDelegates > 0) {
        // Normalize to previous round if we
        this.appConfig.loading.snapshot = (round > 1) ? (round - 1) : 1;
      }
    }
    return this.roundsLogic.lastInRound(round - 1);
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
          RoundChanges: this.RoundChanges,
          logger      : this.logger,
        },
        models : {
          AccountsModel: this.AccountsModel,
          BlocksModel  : this.BlocksModel,
          RoundsModel  : this.RoundsModel,
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
    const res = await this.RoundsModel.sumRound(this.constants.activeDelegates, round, tx);

    const roundRewards   = res.rewards.map((reward) => Math.floor(parseFloat(reward)));
    const roundFees      = Math.floor(parseFloat(res.fees));
    const roundDelegates = res.delegates;

    return { roundRewards, roundFees, roundDelegates };
  }

}
