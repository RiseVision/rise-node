import * as crypto from 'crypto';
import { IDatabase } from 'pg-promise';
import {
  constants,
  Ed,
  ILogger,
  OrderBy,
  Sequence,
  Slots,
} from '../helpers/';
import { IAppState, IBroadcasterLogic, IRoundsLogic, } from '../ioc/interfaces/logic';
import {
  IAccountsModule, IBlocksModule, IBlocksModuleProcess, IDelegatesModule, ITransactionsModule,
} from '../ioc/interfaces/modules';
import { BlockRewardLogic, MemAccountsData, SignedBlockType } from '../logic/';
import { AppConfig } from '../types/genericTypes';
import { publicKey } from '../types/sanityTypes';
// tslint:disable-next-line interface-over-type-literal
export type DelegatesModuleLibrary = {
  logger: ILogger
  sequence: Sequence
  ed: Ed,
  db: IDatabase<any>
  io: SocketIO.Server
  schema: any
  balancesSequence: Sequence,
  logic: {
    appState: IAppState,
    rounds: IRoundsLogic
  },
  config: AppConfig
};

export class DelegatesModule implements IDelegatesModule {
  private blockReward: BlockRewardLogic = new BlockRewardLogic();
  private loaded: boolean               = false;
  private modules: {
    blocks: IBlocksModule,
    accounts: IAccountsModule
    transactions: ITransactionsModule,
  };

  constructor(public library: DelegatesModuleLibrary) {
  }

  public async checkConfirmedDelegates(pk: publicKey, votes: string[]) {
    return this.checkDelegates(pk, votes, 'confirmed');
  }

  public async checkUnconfirmedDelegates(pk: publicKey, votes: string[]) {
    return this.checkDelegates(pk, votes, 'unconfirmed');
  }

  /**
   * Generate a randomized list for the round of which the given height is into.
   * @param {number} height blockheight.
   * @return {Promise<publicKey[]>}
   */
  public async generateDelegateList(height: number): Promise<publicKey[]> {
    const pkeys      = await this.getKeysSortByVote();
    const seedSource = this.library.logic.rounds.calcRound(height).toString();
    let currentSeed  = crypto.createHash('sha256').update(seedSource, 'utf8').digest();

    // Shuffle public keys.
    for (let i = 0, delCount = pkeys.length; i < delCount; i++) {
      for (let x = 0; x < 4 && i < delCount; i++, x++) {
        const newIndex  = currentSeed[x] % delCount;
        const b         = pkeys[newIndex];
        pkeys[newIndex] = pkeys[i];
        pkeys[i]        = b;
      }
      currentSeed = crypto.createHash('sha256').update(currentSeed).digest();
    }

    return pkeys;
  }

  /**
   * Gets delegates and for each calculate rank approval and productivity.
   */
  public async getDelegates(query: { limit?: number, offset?: number, orderBy: string }): Promise<{
    delegates: Array<MemAccountsData & { rank: number, approval: number, productivity: number }>,
    count: number,
    offset: number,
    limit: number,
    sortField: string,
    sortMethod: 'ASC' | 'DESC'
  }> {
    if (!query) {
      throw new Error('Missing query argument');
    }

    const delegates = await this.modules.accounts.getAccounts({
        isDelegate: 1,
        sort      : {vote: -1, publicKey: 1},
      },
      ['username', 'address', 'publicKey', 'vote', 'missedblocks', 'producedblocks']
    );

    const limit  = Math.min(constants.activeDelegates, query.limit || constants.activeDelegates);
    const offset = query.offset || 0;

    const count     = delegates.length;
    const realLimit = Math.min(offset + limit, count);

    const lastBlock   = this.modules.blocks.lastBlock;
    const totalSupply = this.blockReward.calcSupply(lastBlock.height);

    const crunchedDelegates: Array<MemAccountsData & { rank: number, approval: number, productivity: number }> = [];
    for (let i = 0; i < delegates.length; i++) {

      const rank     = i + 1;
      const approval = Math.round((delegates[i].vote / totalSupply) * 1e4) / 1e2;

      const percent = Math.abs(
        100 - (delegates[i].missedblocks / ((delegates[i].producedblocks + delegates[i].missedblocks) / 100))
      ) || 0;

      const outsider     = i + 1 > Slots.delegates;
      const productivity = (!outsider) ? Math.round(percent * 1e2) / 1e2 : 0;

      crunchedDelegates.push({
        ... delegates[i],
        ... {rank, approval, productivity},
      });
    }

    const orderBy = OrderBy(query.orderBy, {quoteField: false});

    if (orderBy.error) {
      throw new Error(orderBy.error);
    }

    return {
      count,
      delegates : crunchedDelegates,
      limit     : realLimit,
      offset,
      sortField : orderBy.sortField,
      sortMethod: orderBy.sortMethod,
    };
  }

  /**
   * Assets that the block was signed by the correct delegate.
   */
  public async assertValidBlockSlot(block: SignedBlockType) {
    const delegates = await this.generateDelegateList(block.height);

    const curSlot = Slots.getSlotNumber(block.timestamp);
    const delegId = delegates[curSlot % Slots.delegates];
    if (!(delegId && block.generatorPublicKey === delegId)) {
      this.library.logger.error(`Expected generator ${delegId} Received generator: ${block.generatorPublicKey}`);
      throw new Error(`Failed to verify slot ${curSlot}`);
    }
  }

  public onBind(scope) {
    this.modules = {
      accounts     : scope.accounts,
      blocks       : scope.blocks,
      transactions : scope.transactions,
      // delegates   : scope.delegates,
    };
  }

  public async onBlockchainReady() {
    this.loaded = true;
  }

  public async cleanup() {
    this.loaded = false;
  }

  public isLoaded() {
    return this.loaded;
  }

  /**
   * Get delegates public keys sorted by descending vote.
   */
  private async getKeysSortByVote(): Promise<publicKey[]> {
    const rows = await this.modules.accounts.getAccounts({
      isDelegate: 1,
      limit     : Slots.delegates,
      sort      : {vote: -1, publicKey: 1},
    }, ['publicKey']);
    return rows.map((r) => r.publicKey);
  }

  /**
   * Checks vote integrity for account and controls total votes do not exceed active delegates.
   * @param {publicKey} pk
   * @param votes
   * @param state
   * @return {Promise<void>}
   */
  private async checkDelegates(pk: publicKey, votes: string[], state: 'confirmed' | 'unconfirmed') {
    const account = await this.modules.accounts.getAccount({publicKey: pk});

    if (!account) {
      throw new Error('Account not found');
    }

    const delegates: publicKey[] = (state === 'confirmed' ? account.delegates : account.u_delegates) || ([] as any);
    const existingVotes          = Array.isArray(delegates) ? delegates.length : 0;

    let additions = 0;
    let removals  = 0;

    for (const vote of votes) {
      const sign = vote[0];
      if (sign === '+') {
        additions++;
      } else if (sign === '-') {
        removals++;
      } else {
        throw new Error('Invalid math operator');
      }

      const curPK = vote.substr(1);

      if (!this.library.schema.validate(curPK, {format: 'publicKey', type: 'string'})) {
        throw new Error('Invalid public key');
      }

      if (sign === '+' && delegates.indexOf(curPK) !== -1) {
        throw new Error('Failed to add vote, account has already voted for this delegate');
      }
      if (sign === '-' && delegates.indexOf(curPK) === -1) {
        throw new Error('Failed to remove vote, account has not voted for this delegate');
      }

      // check voted (or unvoted) is actually a delegate.
      // TODO: This can be optimized as it's only effective when "Adding" a vote.
      const del = await this.modules.accounts.getAccount({publicKey: curPK, isDelegate: 1});
      if (!del) {
        throw new Error('Delegate not found');
      }
    }

    const total = existingVotes + additions - removals;

    if (total > constants.maximumVotes) {
      const exceeded = total - constants.maximumVotes;
      throw new Error(`Maximum number of ${constants.maximumVotes} votes exceeded (${exceeded} too many)`);
    }
  }
}
