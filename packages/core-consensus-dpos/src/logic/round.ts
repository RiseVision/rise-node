import {
  IAccountsModel,
  IAccountsModule,
  IBlocksModel,
  ILogger,
} from '@risevision/core-interfaces';
import {
  Address,
  DBCustomOp,
  DBOp,
  SignedBlockType,
} from '@risevision/core-types';
import * as fs from 'fs';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import { RoundChanges, Slots } from '../helpers/';
import { AccountsModelForDPOS } from '../models';

const performVotesSnapshotSQL = fs.readFileSync(
  `${__dirname}/../../sql/queries/performVotesSnapshot.sql`,
  { encoding: 'utf8' }
);
const restoreVotesSnasphotSQL = fs.readFileSync(
  `${__dirname}/../../sql/queries/restoreVotesSnapshot.sql`,
  { encoding: 'utf8' }
);
const recalcVotesSQL = fs.readFileSync(
  `${__dirname}/../../sql/queries/recalcVotes.sql`,
  { encoding: 'utf8' }
);

// tslint:disable-next-line
export interface RoundLogicScope {
  backwards: boolean;
  round: number;
  // List of address which missed a block in this round
  roundOutsiders: Address[];
  roundDelegates: Buffer[];
  roundFees: bigint;
  roundRewards: Array<bigint>;
  finishRound: boolean;
  dposV2: boolean;
  library: {
    logger: ILogger;
    RoundChanges: typeof RoundChanges;
  };
  models: {
    AccountsModel: typeof IAccountsModel;
    BlocksModel: typeof IBlocksModel;
  };
  modules: {
    accounts: IAccountsModule<AccountsModelForDPOS>;
  };
  block: SignedBlockType;
}

export interface IRoundLogicNewable {
  new (scope: RoundLogicScope, slots: Slots): RoundLogic;
}

function toDiffLiteral(column, value: number | bigint) {
  const operand = value > 0 ? '+' : '-';
  // remove sign when serializing to string as operand will already take care of it.
  value = value > 0 ? value : -value;
  if (typeof value !== 'bigint' && typeof value !== 'number') {
    throw new Error('Invalid diff literal');
  }
  return sequelize.literal(`${column} ${operand} ${value}`);
}
// This cannot be injected directly as it needs to be created.
// rounds module.
export class RoundLogic {
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
      if (typeof scope[prop] === 'undefined') {
        throw new Error(`Missing required scope property: ${prop}`);
      }
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
      model: this.scope.models.AccountsModel,
      options: {
        where: {
          address: { [Op.in]: this.scope.roundOutsiders },
        },
      },
      type: 'update',
      values: {
        // tslint:disable-next-line max-line-length
        cmb: this.scope.dposV2
          ? sequelize.literal(`cmb ${this.scope.backwards ? '-' : '+'} 1`)
          : 0,
        missedblocks: sequelize.literal(
          `missedblocks ${this.scope.backwards ? '-' : '+'} 1`
        ),
      },
    };
  }

  /**
   * Update votes for the round
   */
  public reCalcVotes(): DBCustomOp<any> {
    return {
      model: this.scope.models.AccountsModel,
      query: recalcVotesSQL,
      type: 'custom',
    };
  }

  /**
   * In case of backwards calls updateBlockId with '0';
   */
  public markBlockId(): DBOp<any> {
    if (this.scope.backwards) {
      return {
        model: this.scope.models.AccountsModel,
        options: {
          where: {
            blockId: this.scope.block.id,
          },
        },
        type: 'update',
        values: {
          blockId: '0',
        },
      };
    }
    return null;
  }

  /**
   * Performed when rollbacking last block of a round.
   * It restores the votes snapshot from sql
   */
  public performVotesSnapshot(): DBOp<IAccountsModel> {
    return {
      model: this.scope.models.AccountsModel,
      query: performVotesSnapshotSQL,
      type: 'custom',
    };
  }

  /**
   * Performed when rollbacking last block of a round.
   * It restores the votes snapshot from sql
   */
  public restoreVotesSnapshot(): DBOp<IAccountsModel> {
    return {
      model: this.scope.models.AccountsModel,
      query: restoreVotesSnasphotSQL,
      type: 'custom',
    };
  }

  /**
   * For each delegate in round calls mergeAccountAndGet with new Balance
   */
  public applyRound(): Array<DBOp<any>> {
    const roundChanges = new this.scope.library.RoundChanges(
      this.scope,
      this.slots
    );
    const queries: Array<DBOp<any>> = [];

    const delegates = this.scope.roundDelegates;

    for (let i = 0; i < delegates.length; i++) {
      const delegate = delegates[i];
      const changes = roundChanges.at(i);
      this.scope.library.logger.trace('Delegate changes', {
        changes,
        delegate: delegate.toString('hex'),
      });

      // merge Account in the direction.
      queries.push({
        model: this.scope.models.AccountsModel,
        options: {
          limit: 1,
          where: {
            address: this.scope.modules.accounts.generateAddressByPubData(
              delegate
            ),
          },
        },
        type: 'update',
        values: {
          balance: toDiffLiteral(
            'balance',
            this.scope.backwards ? -changes.balance : changes.balance
          ),
          cmb: 0,
          fees: toDiffLiteral(
            'fees',
            this.scope.backwards ? -changes.fees : changes.fees
          ),
          producedblocks: toDiffLiteral(
            'producedblocks',
            this.scope.backwards ? -1 : 1
          ),
          rewards: toDiffLiteral(
            'rewards',
            this.scope.backwards ? -changes.rewards : changes.rewards
          ),
          u_balance: toDiffLiteral(
            'u_balance',
            this.scope.backwards ? -changes.balance : changes.balance
          ),
        },
      });
    }

    // last delegate will always get the remainder fees.
    const remainderDelegate = delegates[delegates.length - 1];

    const remainderChanges = roundChanges.at(delegates.length - 1);

    if (remainderChanges.feesRemaining > 0) {
      const feesRemaining = this.scope.backwards
        ? -remainderChanges.feesRemaining
        : remainderChanges.feesRemaining;

      this.scope.library.logger.trace('Fees remaining', {
        delegate: remainderDelegate.toString('hex'),
        fees: feesRemaining,
      });
      queries.push({
        model: this.scope.models.AccountsModel,
        options: {
          limit: 1,
          where: {
            address: this.scope.modules.accounts.generateAddressByPubData(
              remainderDelegate
            ),
          },
        },
        type: 'update',
        values: {
          balance: toDiffLiteral('balance', feesRemaining),
          fees: toDiffLiteral('fees', feesRemaining),
          u_balance: toDiffLiteral('u_balance', feesRemaining),
        },
      });
    }

    this.scope.library.logger.trace('Applying round', queries.length);
    return queries;
  }

  /**
   * Performs operations to go to the next round.
   */
  public apply(): Array<DBOp<any>> {
    if (this.scope.finishRound) {
      return [
        this.updateMissedBlocks(),
        ...this.applyRound(),
        this.performVotesSnapshot(),
        this.reCalcVotes(),
      ];
    }
    return [];
  }

  /**
   * Land back from a future round
   */
  public undo(): Array<DBOp<any>> {
    if (this.scope.finishRound) {
      return [
        this.updateMissedBlocks(),
        ...this.applyRound(),
        this.restoreVotesSnapshot(),
      ];
    }
    return [];
  }
}
