import * as pgp from 'pg-promise';
import { ITask } from 'pg-promise';
import roundSQL from '../../sql/logic/rounds';
import { ILogger, RoundChanges } from '../helpers/';
import { address, publicKey } from '../types/sanityTypes';

// tslint:disable-next-line
export type RoundLogicScope = {
  backwards: boolean;
  round: number;
  // List of address which missed a block in this round
  roundOutsiders: address[];
  roundDelegates: publicKey[];
  roundFees: any;
  roundRewards: number[];
  finishRound: boolean;
  library: {
    logger: ILogger
  },
  modules: {
    accounts: any;
  }
  block: {
    generatorPublicKey: publicKey;
    id: string;
    height: number;
  }
};

export class RoundLogic {

  constructor(public scope: RoundLogicScope, public task: ITask<any>) {
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
  public mergeBlockGenerator(): Promise<void> {
    return this.scope.modules.accounts.mergeAccountAndGet({
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
  public updateMissedBlocks(): Promise<void> {
    if (this.scope.roundOutsiders.length === 0) {
      return Promise.resolve(); // TODO: This was this.task
    }

    return this.task.none(
      roundSQL
        .updateMissedBlocks(this.scope.backwards),
      [this.scope.roundOutsiders]
    );
  }

  /**
   * Calls sql getVotes and returns the votes by each delegate
   */
  public getVotes(): Promise<Array<{ delegate: string, amount: number }>> {
    return this.task.query(
      roundSQL.getVotes,
      { round: this.scope.round }
    );
  }

  /**
   * Update votes for thie round
   */
  public updateVotes(): Promise<void> {
    return this.getVotes()
      .then((votes) => {
        const queries = votes.map((vote) => pgp.as.format(
          roundSQL.updateVotes,
          {
            address: this.scope.modules.accounts.generateAddressByPublicKey(vote.delegate),
            amount : Math.floor(vote.amount),
          }
        )).join('');
        if (queries.length > 0) {
          return this.task.none(queries);
        } else {
          return Promise.resolve();
        }
      });
  }

  /**
   * In case of backwards calls updateBlockId with '0';
   */
  public markBlockId(): Promise<void> {
    if (this.scope.backwards) {
      return this.task.none(
        roundSQL.updateBlockId,
        {
          newId: '0',
          oldId: this.scope.block.id,
        }
      );
    }
    return Promise.resolve();
  }

  /**
   * Calls sql flush, deletes round from mem_round
   */
  public flushRound(): Promise<void> {
    return this.task.none(
      roundSQL.flush,
      { round: this.scope.round }
    );
  }

  /**
   * REmove blocks higher than this block height
   */
  public truncateBlocks() {
    return this.task.none(
      roundSQL.truncateBlocks,
      { height: this.scope.block.height }
    );
  }

  /**
   * Performed when rollbacking last block of a round.
   * It restores the round snapshot from sql
   */
  public restoreRoundSnapshot() {
    this.scope.library.logger.debug('Restoring mem_round snapshot...');
    return this.task.none(roundSQL.restoreRoundSnapshot);
  }

  /**
   * Performed when rollbacking last block of a round.
   * It restores the round snapshot from sql
   */
  public restoreVotesSnapshot() {
    this.scope.library.logger.debug('Restoring mem_accounts.vote snapshot...');
    return this.task.none(roundSQL.restoreVotesSnapshot);
  }

  /**
   * For each delegate in round calls mergeAccountAndGet with new Balance
   */
  public applyRound(): Promise<void> {
    const roundChanges      = new RoundChanges(this.scope);
    const queries: string[] = [];

    const delegates = this.scope.backwards ?
      this.scope.roundDelegates.reverse() :
      this.scope.roundDelegates;

    for (let i = 0; i < delegates.length; i++) {
      const delegate = delegates[i];
      const changes  = roundChanges.at(i);
      this.scope.library.logger.trace('Delegate changes', { delegate, changes });

      // merge Account in the direction.
      queries.push(this.scope.modules.accounts.mergeAccountAndGetSQL({
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

      queries.push(this.scope.modules.accounts.mergeAccountAndGetSQL({
        balance  : feesRemaining,
        blockId  : this.scope.block.id,
        fees     : feesRemaining,
        publicKey: remainderDelegate,
        round    : this.scope.round,
        u_balance: feesRemaining,
      }));
    }

    this.scope.library.logger.trace('Applying round', queries);
    if (queries.length > 0) {
      return this.task.none(queries.join(''));
    }
    return Promise.resolve();
  }

  /**
   * Performs operations to go to the next round.
   */
  public async land(): Promise<void> {
    await this.updateVotes();
    await this.updateMissedBlocks();
    await this.flushRound();
    await this.applyRound();
    await this.updateVotes();
    await this.flushRound();
  }

  /**
   * Land back from a future round
   */
  public async backwardLand(): Promise<void> {
    await this.updateVotes();
    await this.updateMissedBlocks();
    await this.flushRound();
    await this.applyRound();
    await this.updateVotes();
    await this.flushRound();
    await this.restoreRoundSnapshot();
    await this.restoreVotesSnapshot();
  }
}
