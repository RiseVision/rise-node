import { BlocksModel, BlocksSymbols } from '@risevision/core-blocks';
import {
  AccountFilterData,
  IAccountsModule,
  IAppState,
  IBlockReward,
  IBlocksModule,
  ILogger,
  ITransactionsModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { publicKey, SignedBlockType } from '@risevision/core-types';
import { OrderBy } from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import * as MersenneTwister from 'mersenne-twister';
import { Op } from 'sequelize';
import * as sequelize from 'sequelize';
import * as supersha from 'supersha';
import * as z_schema from 'z-schema';
import {
  DposConstantsType,
  dPoSSymbols,
  DposV2Helper,
  Slots,
} from '../helpers/';
import { RoundsLogic } from '../logic/';
import { AccountsModelForDPOS, DelegatesModel } from '../models';

@injectable()
export class DelegatesModule {
  // Holds the current round delegates cache list.
  private delegatesListCache: { [round: number]: Buffer[] } = {};

  // Generic
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  // Helpers
  @inject(dPoSSymbols.constants)
  private dposConstants: DposConstantsType;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(dPoSSymbols.helpers.slots)
  private slots: Slots;
  @inject(dPoSSymbols.helpers.dposV2)
  private dposV2Helper: DposV2Helper;

  // Logic
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.blockReward)
  private blockReward: IBlockReward;
  @inject(dPoSSymbols.logic.rounds)
  private roundsLogic: RoundsLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule<AccountsModelForDPOS>;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  @inject(ModelSymbols.model)
  @named(BlocksSymbols.model)
  private blocksModel: typeof BlocksModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.delegates)
  private delegatesModel: typeof DelegatesModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.delegates)
  private accountsModel: typeof AccountsModelForDPOS;

  public async checkConfirmedDelegates(
    account: AccountsModelForDPOS,
    votes: string[]
  ) {
    return this.checkDelegates(account, votes, 'confirmed');
  }

  public async checkUnconfirmedDelegates(
    account: AccountsModelForDPOS,
    votes: string[]
  ) {
    return this.checkDelegates(account, votes, 'unconfirmed');
  }

  /**
   * Generate a randomized list for the round of which the given height is into.
   * @param {number} height blockheight.
   * @return {Promise<publicKey[]>}
   */
  // tslint:disable-next-line cognitive-complexity
  public async generateDelegateList(height: number): Promise<Buffer[]> {
    const round = this.roundsLogic.calcRound(height);

    if (!this.delegatesListCache[round]) {
      const isV2 = this.dposV2Helper.isV2(height);
      const excludedList: Buffer[] = [];

      // In DPOS v2, the last delegate to forge a round, totally skips the next one.
      if (isV2) {
        const block = await this.getLastBlockInPrevRound(height);
        excludedList.push(block.generatorPublicKey);
      }
      let delegates = await this.getFilteredDelegatesSortedByVote(
        height,
        excludedList
      );

      // Shuffle the delegates, using the round number as a seed.
      let currentSeed: Buffer;
      // If dposv2 is on, do a Weighted Random Selection of the round forgers.

      if (isV2) {
        let pool: Array<{ publicKey: Buffer; vote: bigint; weight?: number }>;

        // Initialize source random numbers that will generate a predictable sequence, given the seed.
        const roundSeed = await this.calculateSafeRoundSeed(height);
        const generator = new MersenneTwister([...roundSeed]);

        // Assign a weight to each delegate, which is its normalized vote weight multiplied by a random factor
        pool = delegates.map((delegate) => {
          const rand = generator.random(); // 0 >= rand < 1
          return {
            ...delegate,
            // Weighted Random Sampling (Efraimidis, Spirakis, 2005)
            // TODO: With BigInt this might lose precision. Find a different way
            //  to have same result with bigint without int casting.
            weight: rand ** (1 / parseInt(delegate.vote.toString(), 10)),
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
        delegates = pool.slice(0, this.dposConstants.activeDelegates);
        currentSeed = new Buffer(roundSeed.buffer);
      } else {
        const scrambleSeed = this.roundsLogic.calcRound(height).toString();
        currentSeed = supersha.sha256(Buffer.from(scrambleSeed, 'utf8'));
      }

      for (
        let i = 0, delegatesCount = delegates.length;
        i < delegatesCount;
        i++
      ) {
        for (let x = 0; x < 4 && i < delegatesCount; i++, x++) {
          const newIndex = currentSeed[x] % delegatesCount;
          const b = delegates[newIndex];
          delegates[newIndex] = delegates[i];
          delegates[i] = b;
        }
        currentSeed = supersha.sha256(currentSeed);
      }

      this.delegatesListCache[round] = delegates
        .slice(0, this.slots.delegates)
        .map((d) => d.publicKey);

      if (isV2) {
        await this.replaceEndForger(height, round);
      }
    }

    return this.delegatesListCache[round];
  }

  /**
   * Gets delegates and for each calculate rank approval and productivity.
   */
  public async getDelegates(query: {
    limit?: number;
    offset?: number;
    orderBy: string;
  }): Promise<{
    delegates: Array<{
      delegate: AccountsModelForDPOS;
      info: { rank: number; approval: number; productivity: number };
    }>;
    count: number;
    offset: number;
    limit: number;
    sortField: string;
    sortMethod: 'ASC' | 'DESC';
  }> {
    if (!query) {
      throw new Error('Missing query argument');
    }

    const delegates = await this.accountsModule.getAccounts({
      isDelegate: 1,
      sort: this.dposV2Helper.isV1()
        ? { vote: -1, publicKey: 1 }
        : { votesWeight: -1, publicKey: 1 },
    });

    const limit = Math.min(
      this.dposConstants.activeDelegates,
      query.limit || this.dposConstants.activeDelegates
    );
    const offset = query.offset || 0;

    const count = delegates.length;
    const realLimit = Math.min(offset + limit, count);

    const lastBlock = this.blocksModule.lastBlock;
    const totalSupply = this.blockReward.calcSupply(lastBlock.height);

    // tslint:disable-next-line
    const crunchedDelegates: Array<{
      delegate: AccountsModelForDPOS;
      info: { rank: number; approval: number; productivity: number };
    }> = [];
    for (let i = 0; i < delegates.length; i++) {
      const rank = i + 1;
      const approval =
        parseInt(
          ((delegates[i].vote * 10n ** 4n) / totalSupply).toString(),
          10
        ) / 100;

      const percent =
        Math.abs(
          100 -
            delegates[i].missedblocks /
              ((delegates[i].producedblocks + delegates[i].missedblocks) / 100)
        ) || 0;

      const productivity = Math.round(percent * 1e2) / 1e2;

      crunchedDelegates.push({
        delegate: delegates[i],
        info: { rank, approval, productivity },
      });
    }

    const orderBy = OrderBy(query.orderBy, { quoteField: false });

    if (orderBy.error) {
      throw new Error(orderBy.error);
    }

    return {
      count,
      delegates: crunchedDelegates,
      limit: realLimit,
      offset,
      sortField: orderBy.sortField,
      sortMethod: orderBy.sortMethod,
    };
  }

  /**
   * Assets that the block was signed by the correct delegate.
   */
  // @RunThroughExceptions(DposExceptionsList.assertValidSlot)
  public async assertValidBlockSlot(block: SignedBlockType) {
    const delegates = await this.generateDelegateList(block.height);

    const curSlot = this.slots.getSlotNumber(block.timestamp);
    const delegId = delegates[curSlot % this.slots.delegates];
    if (!(delegId && block.generatorPublicKey.equals(delegId))) {
      this.logger.error(
        `Expected generator ${delegId.toString(
          'hex'
        )} Received generator: ${block.generatorPublicKey.toString('hex')}`
      );
      throw new Error(`Failed to verify slot ${curSlot}`);
    }
  }

  /**
   * Get delegates public keys sorted by descending vote.
   */
  // tslint:disable-next-line max-line-length
  private async getFilteredDelegatesSortedByVote(
    height: number,
    exclusionList: Buffer[]
  ): Promise<Array<{ publicKey: Buffer; vote: bigint }>> {
    const filter: AccountFilterData = {
      isDelegate: 1,
    };
    if (this.dposV2Helper.isV1(height)) {
      filter.sort = { vote: -1, publicKey: 1 };
    } else {
      filter.sort = { votesWeight: -1, publicKey: 1 };
      filter.publicKey = { [Op.notIn]: exclusionList || [] };
      filter.cmb = {
        [Op.lte]: this.dposConstants.dposv2.maxContinuousMissedBlocks,
      };
    }

    const poolSize = this.slots.getDelegatesPoolSize(height);
    if (poolSize !== -1) {
      filter.limit = poolSize;
    }
    const rows = await this.accountsModule.getAccounts(filter);
    return rows.map((r) => ({
      publicKey: r.publicKey,
      vote: this.dposV2Helper.isV2(height) ? r.votesWeight : r.vote,
    }));
  }

  /**
   * Checks vote integrity for account and controls total votes do not exceed active delegates.
   * @param {AccountsModel} account
   * @param votes
   * @param state
   * @return {Promise<void>}
   */
  private async checkDelegates(
    account: AccountsModelForDPOS,
    votes: string[],
    state: 'confirmed' | 'unconfirmed'
  ) {
    if (!account) {
      throw new Error('Account not found');
    }

    const delegates: publicKey[] = (
      (state === 'confirmed' ? account.delegates : account.u_delegates) ||
      ([] as any)
    ).map((b: Buffer) => b.toString('hex'));
    const existingVotes = Array.isArray(delegates) ? delegates.length : 0;

    let additions = 0;
    let removals = 0;

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

      if (
        !this.schema.validate(curPK, { format: 'publicKey', type: 'string' })
      ) {
        throw new Error('Invalid public key');
      }

      if (sign === '+' && delegates.indexOf(curPK) !== -1) {
        throw new Error(
          'Failed to add vote, account has already voted for this delegate'
        );
      }
      if (sign === '-' && delegates.indexOf(curPK) === -1) {
        throw new Error(
          'Failed to remove vote, account has not voted for this delegate'
        );
      }

      // check voted (or unvoted) is actually a delegate.
      // TODO: This can be optimized as it's only effective when "Adding" a vote.
      const del = await this.accountsModule.getAccount({
        isDelegate: 1,
        publicKey: new Buffer(curPK, 'hex'),
      });
      if (!del) {
        throw new Error('Delegate not found');
      }
    }

    const total = existingVotes + additions - removals;

    if (total > this.dposConstants.maximumVotes) {
      const exceeded = total - this.dposConstants.maximumVotes;
      throw new Error(
        `Maximum number of ${
          this.dposConstants.maximumVotes
        } votes exceeded (${exceeded} too many)`
      );
    }
  }

  /**
   * Generates an array of 8 32-bit unsigned integers, to be used as seed for the Mersenne Twister PRNG
   * The ID of the last block of the previous round is used as a source, then hashed multiple times and converted to
   * an array of numbers.
   * @param {number} height
   * @returns {Promise<number[]>}
   */
  private async calculateSafeRoundSeed(height: number): Promise<Uint32Array> {
    const block = await this.getLastBlockInPrevRound(height);

    const seedSource: Buffer = supersha.sha256(Buffer.from(block.id, 'utf8'));
    // Convert the sha256 buffer to an array of 32-bit unsigned integers
    return new Uint32Array(seedSource.buffer);
  }

  private async getLastBlockInPrevRound(height: number) {
    const currentRound = this.roundsLogic.calcRound(height);

    const previousRoundLastBlockHeight = this.roundsLogic.lastInRound(
      currentRound - 1
    );
    // Get the last block of previous round from database
    const block = await this.blocksModel.findOne({
      limit: 1,
      where: { height: { [Op.eq]: previousRoundLastBlockHeight } },
    });

    if (block === null) {
      throw new Error(
        `Error in Round Seed calculation, block ${previousRoundLastBlockHeight} not found`
      );
    }
    return block;
  }

  /**
   * Modifies the cached delegates list by choosing the delegate who will forge the last block of the round.
   * It will be the one in the list who was in this position less recently.
   * @param {number} height
   * @param {number} round
   * @returns {Promise<void>}
   */
  private async replaceEndForger(height: number, round: number) {
    // Gets all "recent" blocks forged exactly at the end of round to find the producer who should be the next one
    // to forge in last position (and so to skip next round), sorted by Max height and grouped by generatorPublicKey
    const res: any = await this.blocksModel.findAll({
      attributes: [
        [sequelize.fn('MAX', sequelize.col('height')), 'lastRoundEndHeight'],
        'generatorPublicKey',
      ],
      group: 'generatorPublicKey',
      order: sequelize.literal('"lastRoundEndHeight" ASC'),
      raw: true,
      where: {
        [Op.and]: [
          {
            height: {
              [Op.gte]:
                height -
                this.slots.delegates *
                  this.dposConstants.dposv2.delegatesPoolSize,
            },
          },
          sequelize.literal(`height % ${this.slots.delegates} = 0`),
          {
            generatorPublicKey: {
              [Op.in]: this.delegatesListCache[round],
            },
          },
        ],
      },
    });

    // Polyfill delegates that never forged the last block in a round.
    this.delegatesListCache[round].forEach((d) => {
      if (!res.find((a) => a.generatorPublicKey.equals(d))) {
        res.push({
          generatorPublicKey: d,
          lastRoundEndHeight: 0,
        });
      }
    });

    // Choose the delegate that forged the last block in a round less recently
    let chosenDelegate: Buffer = null;
    let minLastRoundEndHeight: number = Number.MAX_SAFE_INTEGER;
    res.forEach(({ lastRoundEndHeight, generatorPublicKey }) => {
      if (lastRoundEndHeight < minLastRoundEndHeight) {
        minLastRoundEndHeight = lastRoundEndHeight;
        chosenDelegate = generatorPublicKey;
      }
    });

    // Move the chosen delegate to the last position in the array.
    if (chosenDelegate !== null) {
      const index = this.delegatesListCache[round].findIndex((pk) =>
        pk.equals(chosenDelegate)
      );
      this.delegatesListCache[round].splice(index, 1);
      this.delegatesListCache[round].push(chosenDelegate);
    }
  }
}
