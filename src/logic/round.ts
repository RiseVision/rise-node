import * as sequelize from 'sequelize';
import { ILogger, RoundChanges, Slots } from '../helpers/';
import { IRoundLogic } from '../ioc/interfaces/logic/';
import { IAccountsModule } from '../ioc/interfaces/modules';
import { AccountsModel, BlocksModel, RoundsModel } from '../models';
import roundSQL from '../sql/logic/rounds';
import { DBCustomOp, DBOp } from '../types/genericTypes';
import { address } from '../types/sanityTypes';
import { SignedBlockType } from './block';

// tslint:disable-next-line
export type RoundLogicScope = {
  backwards: boolean;
  round: number;
  // List of address which missed a block in this round
  roundOutsiders: address[];
  roundDelegates: Buffer[];
  roundFees: any;
  roundRewards: number[];
  finishRound: boolean;
  library: {
    logger: ILogger
  },
  models: {
    AccountsModel: typeof AccountsModel,
    BlocksModel: typeof BlocksModel,
    RoundsModel: typeof RoundsModel,
  }
  modules: {
    accounts: IAccountsModule;
  }
  block: SignedBlockType
  // must be populated with the votes in round when is needed
  votes?: Array<{ delegate: string, amount: number }>
};

// This cannot be injected directly as it needs to be created.
// rounds module.
export class RoundLogic implements IRoundLogic {
  constructor(public scope: RoundLogicScope, private slots: Slots) {
    let reqProps = ['library', 'modules', 'block', 'round', 'backwards'];
    if (scope.finishRound) {
      reqProps = reqProps.concat([
        'roundFees',
        'roundRewards',
        'roundDelegates',
        'roundOutsiders',
      ]);
    }

    reqProps.forEach((prop) => {
      if (typeof(scope[prop]) === 'undefined') {
        throw new Error(`Missing required scope property: ${prop}`);
      }
    });
  }

  /**
   * Adds or remove the blocks to the generator account.
   * @returns {Promise<void>}
   */
  public mergeBlockGenerator(): Array<DBOp<any>> {
    return this.scope.modules.accounts.mergeAccountAndGetOPs({
      blockId       : this.scope.block.id,
      producedblocks: (this.scope.backwards ? -1 : 1),
      publicKey     : this.scope.block.generatorPublicKey,
      round         : this.scope.round,
    });
  }

  /**
   * Updates accounts and add a missing block to whoever skipped one
   * @returns {Promise<void>}
   */
  public updateMissedBlocks(): DBOp<any> {
    if (this.scope.roundOutsiders.length === 0) {
      return null;
    }
    return {
      model  : this.scope.models.AccountsModel,
      options: {
        where: {
          address: { $in: this.scope.roundOutsiders },
        },
      },
      type   : 'update',
      values : {
        missedblocks: sequelize.literal(`missedblocks ${this.scope.backwards ? '-' : '+'}1`),
      },
    };
  }

  /**
   * Update votes for the round
   */
  public updateVotes(): DBCustomOp<any> {
    return {
      model: this.scope.models.AccountsModel,
      query: this.scope.models.RoundsModel.updateVotesSQL(this.scope.round),
      type : 'custom',
    };
  }

  /**
   * In case of backwards calls updateBlockId with '0';
   */
  public markBlockId(): DBOp<any> {
    if (this.scope.backwards) {
      return {
        model  : this.scope.models.AccountsModel,
        options: {
          where: {
            blockId: this.scope.block.id,
          },
        },
        type   : 'update',
        values : {
          blockId: '0',
        },
      };
    }
    return null;
  }

  /**
   * Calls sql flush, deletes round from mem_round
   */
  public flushRound(): DBOp<any> {
    return {
      model  : this.scope.models.RoundsModel,
      options: { where: { round: this.scope.round } },
      type   : 'remove',
    };
  }

  /**
   * Remove blocks higher than this block height
   */
  public truncateBlocks(): DBOp<BlocksModel> {
    return {
      model  : this.scope.models.BlocksModel,
      options: { where: { height: { $gt: this.scope.block.height } } },
      type   : 'remove',
    };
  }

  /**
   * Performed when rollbacking last block of a round.
   * It restores the round snapshot from sql
   */
  public restoreRoundSnapshot(): DBOp<RoundsModel> {
    return {
      model: this.scope.models.RoundsModel,
      query: roundSQL.restoreRoundSnapshot,
      type: 'custom',
    };
  }

  /**
   * Performed when rollbacking last block of a round.
   * It restores the votes snapshot from sql
   */
  public restoreVotesSnapshot(): DBOp<AccountsModel> {
    return {
      model: this.scope.models.AccountsModel,
      query: roundSQL.restoreVotesSnapshot,
      type: 'custom',
    };
  }

  /**
   * For each delegate in round calls mergeAccountAndGet with new Balance
   */
  public applyRound(): Array<DBOp<any>> {
    const roundChanges              = new RoundChanges(this.scope, this.slots);
    const queries: Array<DBOp<any>> = [];

    const delegates = this.scope.backwards ?
      this.scope.roundDelegates.reverse() :
      this.scope.roundDelegates;

    for (let i = 0; i < delegates.length; i++) {
      const delegate = delegates[i];
      const changes  = roundChanges.at(i);
      this.scope.library.logger.trace('Delegate changes', { delegate, changes });

      // merge Account in the direction.
      queries.push(... this.scope.modules.accounts.mergeAccountAndGetOPs({
        balance  : (this.scope.backwards ? -changes.balance : changes.balance),
        blockId  : this.scope.block.id,
        fees     : (this.scope.backwards ? -changes.fees : changes.fees),
        publicKey: delegate,
        rewards  : (this.scope.backwards ? -changes.rewards : changes.rewards),
        round    : this.scope.round,
        u_balance: (this.scope.backwards ? -changes.balance : changes.balance),
      }));
    }

    // last delegate will always get the remainder fees.
    const remainderIndex    = this.scope.backwards ? 0 : delegates.length - 1;
    const remainderDelegate = delegates[remainderIndex];

    const remainderChanges = roundChanges.at(remainderIndex);

    if (remainderChanges.feesRemaining > 0) {
      const feesRemaining = (this.scope.backwards ? -remainderChanges.feesRemaining : remainderChanges.feesRemaining);

      this.scope.library.logger.trace('Fees remaining', {
        delegate: remainderDelegate,
        fees    : feesRemaining,
        index   : remainderIndex,
      });

      queries.push(... this.scope.modules.accounts.mergeAccountAndGetOPs({
        balance  : feesRemaining,
        blockId  : this.scope.block.id,
        fees     : feesRemaining,
        publicKey: remainderDelegate,
        round    : this.scope.round,
        u_balance: feesRemaining,
      }));
    }

    this.scope.library.logger.trace('Applying round', queries.length);
    return queries;
  }

  /**
   * Performs operations to go to the next round.
   */
  public land(): Array<DBOp<any>> {
    return [
      this.updateVotes(),
      this.updateMissedBlocks(),
      this.flushRound(),
      ...this.applyRound(),
      this.updateVotes(),
      this.flushRound(),
    ];
  }

  /**
   * Land back from a future round
   */
  public backwardLand(): Array<DBOp<any>> {
    return [
      this.updateVotes(),
      this.updateMissedBlocks(),
      this.flushRound(),
      ...this.applyRound(),
      this.updateVotes(),
      this.flushRound(),
      this.restoreRoundSnapshot(),
      this.restoreVotesSnapshot(),
    ];
  }
}
