import {
  IAccountsModel,
  IAccountsModule,
  IAppState,
  IBlocksModel,
  IDBHelper,
  ILogger,
  Symbols
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { address, DBOp, SignedBlockType } from '@risevision/core-types';
import * as fs from 'fs';
import { inject, injectable, named } from 'inversify';
import * as sequelize from 'sequelize';
import { Transaction } from 'sequelize';
import SocketIO from 'socket.io';
import { DposConstantsType, dPoSSymbols, RoundChanges, Slots } from '../helpers';
import { IRoundLogicNewable, RoundLogicScope } from '../logic/round';
import { RoundsLogic } from '../logic/rounds';
import { AccountsModelForDPOS } from '../models/';
import { DelegatesModule } from './delegates';

const sumRoundSQL = fs.readFileSync(
  `${__dirname}/../../sql/sumRound.sql`,
  { encoding: 'utf8' }
);

@injectable()
export class RoundsModule {
  @inject(dPoSSymbols.helpers.roundChanges)
  private RoundChanges: typeof RoundChanges;

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

  /**
   * Performs a backward tick on the round
   * @param {SignedBlockType} block
   * @param {SignedBlockType} previousBlock
   */
  public backwardTick(block: IBlocksModel, previousBlock: SignedBlockType): Promise<Array<DBOp<any>>> {
    return this.innerTick(block, true, async (roundLogicScope) => {
      this.logger.debug('Performing backward tick');

      const roundLogic            = new this.RoundLogic(roundLogicScope, this.slots);
      const ops: Array<DBOp<any>> = [];
      if (roundLogicScope.finishRound) {
        // call backwardLand only if this was the last block in round.
        ops.push(... roundLogic.backwardLand());
      }
      ops.push(roundLogic.markBlockId());
      return ops;
    });
  }

  public async tick(block: SignedBlockType): Promise<Array<DBOp<any>>> {
    return this.innerTick<Array<DBOp<any>>>(
      block,
      false,
      async (roundLogicScope): Promise<Array<DBOp<any>>> => {
        this.logger.debug('Performing forward tick');
        const roundLogic            = new this.RoundLogic(roundLogicScope, this.slots);
        const ops: Array<DBOp<any>> = [];
        if (roundLogicScope.finishRound) {
          ops.push(... roundLogic.land());
        }
        return ops;
      });
  }

  private async innerTick<T>(block: SignedBlockType,
                             backwards: boolean,
                             txGenerator: (ls: RoundLogicScope) => Promise<T>): Promise<T> {
    const round     = this.roundsLogic.calcRound(block.height);
    const nextRound = this.roundsLogic.calcRound(block.height + 1);

    const finishRound = (
      (nextRound !== round) || (block.height === 1)
    );
    try {
      // Set ticking flag to true
      this.appStateLogic.set('rounds.isTicking', true);
      let roundSums = finishRound ? await this.sumRound(round) : null;
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
        },
        modules: {
          accounts: this.accountsModule,
        },
        round,
        roundOutsiders,
        ...roundSums,
      };
      const r = await txGenerator(roundLogicScope);
      this.appStateLogic.set('rounds.isTicking', false);
      return r;
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
  private async sumRound(round: number): Promise<{ roundFees: number, roundRewards: number[], roundDelegates: Buffer[] }> {
    this.logger.debug('Summing round', round);
    // tslint:disable-next-line
    type sumRoundRes = { fees: null | string, rewards: null | string[], delegates: null | Buffer[] };
    const res: sumRoundRes = await this.AccountsModel.sequelize.query(
      sumRoundSQL,
      {
        plain       : true, // Returns single row.
        replacements: { activeDelegates: this.constants.activeDelegates, round },
        type        : sequelize.QueryTypes.SELECT,
      }
    );

    const roundRewards   = res.rewards.map((reward) => Math.floor(parseFloat(reward)));
    const roundFees      = Math.floor(parseFloat(res.fees));
    const roundDelegates = res.delegates;

    return { roundRewards, roundFees, roundDelegates };
  }

}
