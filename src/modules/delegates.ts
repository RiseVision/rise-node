import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import * as MersenneTwister from 'mersenne-twister';
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
import { AccountFilterData, BlockRewardLogic, SignedBlockType } from '../logic/';
import { AccountsModel, BlocksModel, TransactionsModel } from '../models';
import { publicKey } from '../types/sanityTypes';
import { FieldsInModel } from '../types/utils';

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

  // Models
  @inject(Symbols.models.blocks)
  private BlocksModel: typeof BlocksModel;
  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  private roundSeeds: {[seed: number]: number[]} = {};

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
    let delegates  = await this.getKeysSortByVote();
    const seedSource = this.roundsLogic.calcRound(height).toString();

    // If dposv2 is on, do a Weighted Random Selection of the round forgers.
    if (height >= this.constants.dposv2.firstBlock) {
      let pool: Array<{publicKey: Buffer, vote: number, weight?: number}>;

      // Initialize source random numbers that will generate a predictable sequence, given the seed.
      const generator = new MersenneTwister(this.calculateSafeRoundSeed(height));

      // Assign a weight to each delegate, which is its normalized vote weight multiplied by a random factor
      pool = delegates.map((delegate) => {
        const rand = generator.random(); // 0 >= rand < 1
        return {
          ...delegate,
          weight: rand ** ( 1 / delegate.vote ), // Weighted Random Sampling (Efraimidis, Spirakis, 2005)
        };
      });

      // Sort by weight
      pool.sort((a, b) => {
        // If two elements have the same weight, publicKey defines the position (higher value first)
        if (a.weight === b.weight) {
          return Buffer.compare(b.publicKey, a.publicKey);
        }
        return a.weight > b.weight ? -1 : 1;
      });
      delegates = pool.slice(0, this.constants.activeDelegates);
    }

    // Shuffle the delegates.
    let currentSeed  = crypto.createHash('sha256').update(seedSource, 'utf8').digest();

    for (let i = 0, delegatesCount = delegates.length; i < delegatesCount; i++) {
      for (let x = 0; x < 4 && i < delegatesCount; i++, x++) {
        const newIndex  = currentSeed[x] % delegatesCount;
        const b         = delegates[newIndex];
        delegates[newIndex] = delegates[i];
        delegates[i]        = b;
      }
      currentSeed = crypto.createHash('sha256').update(currentSeed).digest();
    }

    return delegates.slice(0, this.slots.delegates).map((d) => d.publicKey);
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
    const sort: {vote?: 1|-1, votesWeight?: 1|-1, publicKey: 1|-1} =
            this.blocksModule.lastBlock.height < this.constants.dposv2.firstBlock ?
              {vote: -1, publicKey: 1} : {votesWeight: -1, publicKey: 1};
    const delegates = await this.accountsModule.getAccounts({
        isDelegate: 1,
        sort,
      },
      ['username', 'address', 'publicKey', 'vote', 'votesWeight', 'missedblocks', 'producedblocks']
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

      const outsider     = i + 1 > this.slots.delegates;
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
    const delegId = delegates[curSlot % this.slots.delegates];
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
    const fields: FieldsInModel<AccountsModel> = ['publicKey'];
    let sort: string | { [k: string]: -1 | 1 };
    if (this.blocksModule.lastBlock.height < this.constants.dposv2.firstBlock) {
      sort = {vote: -1, publicKey: 1};
      fields.push('vote');
    } else {
      sort = {votesWeight: -1, publicKey: 1};
      fields.push('votesWeight');
    }
    const filter: AccountFilterData = {
      isDelegate: 1,
      sort,
    };
    const poolSize = this.slots.getDelegatesPoolSize();
    if (poolSize !== -1) {
      filter.limit = poolSize;
    }
    const rows = await this.accountsModule.getAccounts(filter, fields);
    return rows.map((r) => ({
      publicKey: r.publicKey,
      vote: typeof r.votesWeight !== 'undefined' ? r.votesWeight : r.vote,
    }));
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

  /**
   * Generates an array of 8 32-bit unsigned integers, to be used as seed for the Mersenne Twister PRNG
   * The ID of the last block of the previous round is used as a source, then hashed multiple times and converted to
   * an array of numbers.
   * @param {number} height
   * @returns {Promise<number[]>}
   */
  // TODO: Maybe move elsewhere? Separate cache from calculation logic ?
  private async calculateSafeRoundSeed(height: number): Promise<number[]> {
    const currentRound = this.roundsLogic.calcRound(height);
    // Calculation is expensive, let's keep a cache of seeds
    if (typeof this.roundSeeds[currentRound] !== 'undefined') {
      // Return from cache if found
      return this.roundSeeds[currentRound];
    } else {
      // Make sure cache has max 100 elements
      const keys = Object.keys(this.roundSeeds);
      if (keys.length >= 100) {
        for (let i = 0; i <= keys.length - 100; i++) {
          delete this.roundSeeds[keys[0]];
        }
      }
    }
    const previousRoundLastBlockHeight = this.roundsLogic.lastInRound(currentRound - 1);
    // Get the last block of previous round from database
    const block = await this.BlocksModel.
      findById(previousRoundLastBlockHeight, { include: [this.TransactionsModel] });
    if (block === null) {
      throw new Error(`Error in Round Seed calculation, block ${previousRoundLastBlockHeight} not found`);
    }

    // Hash the Block ID several times. This is here to discourage attempts to alter block ID by forgers to get a
    // higher chance to get forging in the next round.
    let seedSource = crypto.createHash('sha256').update(block.id, 'utf8').digest();
    for (let i = 0; i < 10000; i++) {
      seedSource = crypto.createHash('sha256').update(seedSource).digest();
    }

    // Convert the sha256 buffer to an array of 32-bit unsigned integers
    const seed: number[] = [];
    for (let i = 0; i < seedSource.length; i += 4) {
      const chunk = seedSource.slice(i, i + 4);
      // Reverse for little-endianness
      chunk.reverse();
      const u32 = new Uint32Array(new Uint8Array(chunk).buffer);
      seed.push(u32[0]);
    }

    // Save in cache
    this.roundSeeds[currentRound] = seed;
    return seed;
  }
}
