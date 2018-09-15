import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import * as z_schema from 'z-schema';
import {
  constants as constantsType, ExceptionsList, ExceptionsManager,
  ILogger,
  OrderBy,
  Slots,
} from '../helpers/';
import { RunThroughExceptions } from '../helpers/decorators/exceptions';
import { IAppState, IRoundsLogic, } from '../ioc/interfaces/logic';
import {
  IAccountsModule, IBlocksModule, IDelegatesModule, ITransactionsModule,
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { BlockRewardLogic, SignedBlockType } from '../logic/';
import { AccountsModel } from '../models';
import { publicKey } from '../types/sanityTypes';

@injectable()
export class DelegatesModule implements IDelegatesModule {
  private loaded: boolean               = false;

  // Generic
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  // Helpers
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.exceptionsManager)
  public excManager: ExceptionsManager;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.slots)
  private slots: Slots;

  // Logic
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.blockReward)
  private blockReward: BlockRewardLogic;
  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  public async checkConfirmedDelegates(account: AccountsModel, votes: string[]) {
    return this.checkDelegates(account, votes, 'confirmed');
  }

  public async checkUnconfirmedDelegates(account: AccountsModel, votes: string[]) {
    return this.checkDelegates(account, votes, 'unconfirmed');
  }

  /**
   * Generate a randomized list for the round of which the given height is into.
   * @param {number} height blockheight.
   * @return {Promise<publicKey[]>}
   */
  public async generateDelegateList(height: number): Promise<Buffer[]> {
    const delegates      = await this.getKeysSortByVote();
    const seedSource = this.roundsLogic.calcRound(height).toString();
    let currentSeed  = crypto.createHash('sha256').update(seedSource, 'utf8').digest();

    // Shuffle the first ${constants.activeDelegates or less} delegates.
    const delegatesCount = delegates.length < this.constants.activeDelegates ?
      delegates.length : this.constants.activeDelegates;

    for (let i = 0; i < delegatesCount; i++) {
      for (let x = 0; x < 4 && i < delegatesCount; i++, x++) {
        const newIndex  = currentSeed[x] % delegatesCount;
        const b         = delegates[newIndex];
        delegates[newIndex] = delegates[i];
        delegates[i]        = b;
      }
      currentSeed = crypto.createHash('sha256').update(currentSeed).digest();
    }

    // Rank the remaining ${constants.fairVoteSystem.outsidersPoolSize or less} keys.
    if (delegates.length > this.constants.activeDelegates && height >= this.constants.fairVoteSystem.firstBlock) {
      let outsiders: Array<{publicKey: Buffer, vote: number, score?: number}>;
      outsiders = delegates.slice(this.constants.activeDelegates, this.constants.fairVoteSystem.outsidersPoolSize);

      let swapSeed = crypto.createHash('sha256').update(seedSource, 'utf8').digest();
      while (swapSeed.length < outsiders.length) {
        swapSeed = Buffer.concat([swapSeed,
          crypto.createHash('sha256').update(swapSeed, 'utf8').digest()]);
      }

      outsiders = outsiders.map((d, index) => {
        const weightedVoteRanking = index * this.constants.fairVoteSystem.forgingProbability.voteWeight;
        const weightedOrderRanking = (swapSeed[index] % outsiders.length) *
          this.constants.fairVoteSystem.forgingProbability.orderWeight;
        d.score = weightedVoteRanking + weightedOrderRanking;
        return d;
      });

      this.selectionSortOutsiders(outsiders);

      outsiders.forEach((d, index) => {
        delegates[this.constants.activeDelegates + index] = d;
      });
    }

    return delegates.slice(0, this.slots.numDelegates(height)).map((d) => d.publicKey);
  }

  /**
   * Gets delegates and for each calculate rank approval and productivity.
   */
  public async getDelegates(query: { limit?: number, offset?: number, orderBy: string }): Promise<{
    delegates: Array<{
      delegate: AccountsModel,
      info: { rank: number, approval: number, productivity: number }
    }>,
    count: number,
    offset: number,
    limit: number,
    sortField: string,
    sortMethod: 'ASC' | 'DESC'
  }> {
    if (!query) {
      throw new Error('Missing query argument');
    }

    const delegates = await this.accountsModule.getAccounts({
        isDelegate: 1,
        sort      : {vote: -1, publicKey: 1},
      },
      ['username', 'address', 'publicKey', 'vote', 'missedblocks', 'producedblocks']
    );

    const limit  = Math.min(this.slots.getDelegatesPoolSize(), query.limit || this.slots.getDelegatesPoolSize());
    const offset = query.offset || 0;

    const count     = delegates.length;
    const realLimit = Math.min(offset + limit, count);

    const lastBlock   = this.blocksModule.lastBlock;
    const totalSupply = this.blockReward.calcSupply(lastBlock.height);

    // tslint:disable-next-line
    const crunchedDelegates: Array<{delegate: AccountsModel, info: { rank: number, approval: number, productivity: number }}> = [];
    for (let i = 0; i < delegates.length; i++) {

      const rank     = i + 1;
      const approval = Math.round((delegates[i].vote / totalSupply) * 1e4) / 1e2;

      const percent = Math.abs(
        100 - (delegates[i].missedblocks / ((delegates[i].producedblocks + delegates[i].missedblocks) / 100))
      ) || 0;

      const outsider     = i + 1 > this.slots.numDelegates();
      const productivity = (!outsider) ? Math.round(percent * 1e2) / 1e2 : 0;

      crunchedDelegates.push({
        delegate: delegates[i],
        info: {rank, approval, productivity},
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
  @RunThroughExceptions(ExceptionsList.assertValidSlot)
  public async assertValidBlockSlot(block: SignedBlockType) {
    const delegates = await this.generateDelegateList(block.height);

    const curSlot = this.slots.getSlotNumber(block.timestamp);
    const delegId = delegates[curSlot % this.slots.numDelegates(block.height)];
    if (!(delegId && block.generatorPublicKey.equals(delegId))) {
      this.logger.error(`Expected generator ${delegId.toString('hex')} Received generator: ${block.generatorPublicKey.toString('hex')}`);
      throw new Error(`Failed to verify slot ${curSlot}`);
    }
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
  private async getKeysSortByVote(): Promise<Array<{publicKey: Buffer, vote: number}>> {
    const rows = await this.accountsModule.getAccounts({
      isDelegate: 1,
      limit     : this.slots.getDelegatesPoolSize(),
      sort      : {vote: -1, publicKey: 1},
    }, ['publicKey', 'vote']);
    return rows.map((r) => ({publicKey: r.publicKey, vote: r.vote}));
  }

  /**
   * Checks vote integrity for account and controls total votes do not exceed active delegates.
   * @param {AccountsModel} account
   * @param votes
   * @param state
   * @return {Promise<void>}
   */
  private async checkDelegates(account: AccountsModel, votes: string[], state: 'confirmed' | 'unconfirmed') {
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

      if (!this.schema.validate(curPK, {format: 'publicKey', type: 'string'})) {
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
      const del = await this.accountsModule.getAccount({publicKey: new Buffer(curPK, 'hex'), isDelegate: 1});
      if (!del) {
        throw new Error('Delegate not found');
      }
    }

    const total = existingVotes + additions - removals;

    if (total > this.constants.maximumVotes) {
      const exceeded = total - this.constants.maximumVotes;
      throw new Error(`Maximum number of ${this.constants.maximumVotes} votes exceeded (${exceeded} too many)`);
    }
  }

  // We use a predictable sorting algorithm (Selection sort) to avoid ordering differences in case of equal scores.
  private selectionSortOutsiders(outsiders: Array<{publicKey: Buffer, vote: number, score?: number }>) {
    let i: number;
    let j: number;
    const n = outsiders.length;
    for (j = 0; j < n - 1; j++) {
      let iMin = j;
      for (i = j + 1; i < n; i++) {
        if (outsiders[i].score < outsiders[iMin].score) {
          iMin = i;
        }
      }
      if (iMin !== j) {
        // Swap
        const tmp = outsiders[j];
        outsiders[j] = outsiders[iMin];
        outsiders[iMin] = tmp;
      }
    }
  }
}
