import {
  IAccountsModel,
  IAccountsModule,
  IAppState,
  IBlocksModel,
  IDBHelper,
  ILogger,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { Address, DBOp, SignedBlockType } from '@risevision/core-types';
import * as fs from 'fs';
import { inject, injectable, named } from 'inversify';
import * as sequelize from 'sequelize';
import SocketIO from 'socket.io';
import {
  DposConstantsType,
  dPoSSymbols,
  RoundChanges,
  Slots,
} from '../helpers';
import { IRoundLogicNewable, RoundLogicScope, RoundsLogic } from '../logic/';
import { AccountsModelForDPOS } from '../models/';
import { DelegatesModule } from './delegates';

const sumRoundSQL = fs.readFileSync(
  `${__dirname}/../../sql/queries/sumRound.sql`,
  {
    encoding: 'utf8',
  }
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
  public backwardTick(
    block: SignedBlockType,
    previousBlock: SignedBlockType
  ): Promise<Array<DBOp<any>>> {
    return this.innerTick(block, true, async (roundLogicScope) => {
      this.logger.debug('Performing backward tick');

      const roundLogic = new this.RoundLogic(roundLogicScope, this.slots);
      const ops: Array<DBOp<any>> = [];
      ops.push(...roundLogic.undo());
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
        const roundLogic = new this.RoundLogic(roundLogicScope, this.slots);
        const ops: Array<DBOp<any>> = [];
        ops.push(...roundLogic.apply());
        return ops;
      }
    );
  }

  private async innerTick<T>(
    block: SignedBlockType,
    backwards: boolean,
    txGenerator: (ls: RoundLogicScope) => Promise<T>
  ): Promise<T> {
    const round = this.roundsLogic.calcRound(block.height);
    const nextRound = this.roundsLogic.calcRound(block.height + 1);

    const finishRound = nextRound !== round || block.height === 1;
    try {
      // Set ticking flag to true
      this.appStateLogic.set('rounds.isTicking', true);
      let roundSums = finishRound ? await this.sumRound(round, block) : null;
      if (block.height === 1 && roundSums.roundDelegates.length !== 1) {
        // in round 1 (and height=1) and when verifying snapshot delegates are there (and created in 2nd round #1)
        // so roundDelegates are 101 not 1 (genesis generator) causing genesis to have an extra block accounted.
        // so we fix this glitch by monkeypatching the value and set roundDelegates to the correct genesis generator.
        roundSums = {
          roundDelegates: [block.generatorPublicKey],
          roundFees: 0n,
          roundRewards: [0n],
        };
      }

      const roundOutsiders = finishRound
        ? await this.getOutsiders(round, roundSums.roundDelegates)
        : null;

      const roundLogicScope: RoundLogicScope = {
        backwards,
        block,
        dposV2:
          block.height >= this.constants.dposv2.firstBlock &&
          this.constants.dposv2.firstBlock > 0,
        finishRound,
        library: {
          RoundChanges: this.RoundChanges,
          logger: this.logger,
        },
        models: {
          AccountsModel: this.AccountsModel,
          BlocksModel: this.BlocksModel,
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
      this.logger.warn(
        `Error while doing modules.innerTick [backwards=${backwards}]`,
        e.message || e
      );
      this.appStateLogic.set('rounds.isTicking', false);
      throw e;
    }
  }

  /**
   * Generates outsider array from a given round and roundDelegates (the ones who actually forged something)
   * @return {Promise<address[]>} a list of addresses that missed the blocks
   */
  private async getOutsiders(
    round: number,
    roundDelegates: Buffer[]
  ): Promise<Address[]> {
    const strPKDelegates = roundDelegates.map((r) => r.toString('hex'));

    const height = this.roundsLogic.lastInRound(round);
    const originalDelegates = await this.delegatesModule.generateDelegateList(
      height
    );

    return originalDelegates
      .filter((pk) => strPKDelegates.indexOf(pk.toString('hex')) === -1)
      .map((pk) => this.accountsModule.generateAddressByPubData(pk));
  }

  // tslint:disable-next-line
  private async sumRound(
    round: number,
    block: SignedBlockType
  ): Promise<{
    roundFees: bigint;
    roundRewards: Array<bigint>;
    roundDelegates: Buffer[];
  }> {
    this.logger.debug('Summing round', round);
    // tslint:disable-next-line
    type sumRoundRes = {
      fees: null | bigint;
      rewards: null | string[];
      delegates: null | Buffer[];
    };
    const res: sumRoundRes = await this.AccountsModel.sequelize.query(
      sumRoundSQL,
      {
        plain: true, // Returns single row.
        replacements: {
          activeDelegates: this.constants.activeDelegates,
          round,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const roundRewards = res.rewards.map((reward) =>
      BigInt(Math.floor(parseFloat(reward)))
    );
    let roundFees = res.fees;
    const roundDelegates = res.delegates;

    if (roundDelegates.length === this.constants.activeDelegates - 1) {
      // cur block is not in the database yet. So lets patch the results manually
      roundRewards.push(BigInt(block.reward));
      roundFees += BigInt(block.totalFee);
      roundDelegates.push(block.generatorPublicKey);
    }

    return { roundRewards, roundFees, roundDelegates };
  }
}
