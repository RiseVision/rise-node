import { AccountsSymbols } from '@risevision/core-accounts';
import { BlocksModel, BlocksSymbols } from '@risevision/core-blocks';
import { ModelSymbols } from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import {
  AccountFilterData,
  IAccountsModel,
  IAccountsModule,
  IAppState,
  IBlockReward,
  IBlocksModule,
  ILogger,
  ITransactionsModel,
  ITransactionsModule,
  Symbols,
} from '@risevision/core-types';
import {
  Address,
  DBOp,
  DBUpdateOp,
  publicKey,
  SignedBlockType,
} from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import * as MersenneTwister from 'mersenne-twister';
import { Op, OrderItem } from 'sequelize';
import * as sequelize from 'sequelize';
import * as supersha from 'supersha';
import { As } from 'type-tagger';
import * as z_schema from 'z-schema';
import {
  DposConstantsType,
  dPoSSymbols,
  DposV2Helper,
  Slots,
} from '../helpers/';
import { RoundsLogic } from '../logic/';
import {
  AccountsModelForDPOS,
  DelegatesModel,
  DelegatesRoundModel,
} from '../models';

// tslint:disable-next-line
export type BaseDelegateData = {
  address: Address;
  cmb: number;
  forgingPK: Buffer & As<'publicKey'>;
  username: string;
  vote: bigint;
  votesWeight: bigint;
  producedblocks: number;
  missedblocks: number;
};

@injectable()
export class DelegatesModule {
  // Holds the current round delegates cache list.
  protected delegatesListCache: { [round: number]: Buffer[] } = {};

  @inject(Symbols.generic.txtypes)
  protected txTypes: Array<{ name: symbol; type: number }>;
  // Generic
  @inject(Symbols.generic.zschema)
  protected schema: z_schema;

  // Helpers
  @inject(dPoSSymbols.constants)
  protected dposConstants: DposConstantsType;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.logger)
  protected logger: ILogger;
  @inject(dPoSSymbols.helpers.slots)
  protected slots: Slots;
  @inject(dPoSSymbols.helpers.dposV2)
  protected dposV2Helper: DposV2Helper;

  // Logic
  @inject(Symbols.logic.appState)
  protected appState: IAppState;
  @inject(Symbols.logic.blockReward)
  protected blockReward: IBlockReward;
  @inject(dPoSSymbols.logic.rounds)
  protected roundsLogic: RoundsLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  protected accountsModule: IAccountsModule<AccountsModelForDPOS>;
  @inject(Symbols.modules.blocks)
  protected blocksModule: IBlocksModule;
  @inject(Symbols.modules.transactions)
  protected transactionsModule: ITransactionsModule;

  @inject(ModelSymbols.model)
  @named(BlocksSymbols.model)
  protected blocksModel: typeof BlocksModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.delegates)
  protected delegatesModel: typeof DelegatesModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.delegatesRound)
  protected delegatesRoundModel: typeof DelegatesRoundModel;
  @inject(ModelSymbols.model)
  @named(AccountsSymbols.model)
  protected accountsModel: typeof AccountsModelForDPOS;
  @inject(ModelSymbols.model)
  @named(TXSymbols.models.model)
  protected transactionsModel: typeof ITransactionsModel;

  public async checkConfirmedDelegates(
    account: AccountsModelForDPOS,
    added: string[],
    removed: string[]
  ) {
    return this.checkDelegates(account, added, removed, 'confirmed');
  }

  public async checkUnconfirmedDelegates(
    account: AccountsModelForDPOS,
    added: string[],
    removed: string[]
  ) {
    return this.checkDelegates(account, added, removed, 'unconfirmed');
  }

  public async onBlockChanged(
    direction: 'forward' | 'backward',
    newHeight: number
  ): Promise<Array<DBOp<DelegatesRoundModel>>> {
    const ops: Array<DBOp<DelegatesRoundModel>> = [];
    if (newHeight === 1) {
      // Dont do anything for the first block
      return ops;
    }

    const round = this.roundsLogic.calcRound(newHeight);
    const nextIsLastBlockInRound =
      this.roundsLogic.lastInRound(round) === newHeight + 1;
    const firstBlockInRound =
      this.roundsLogic.firstInRound(round) === newHeight;

    if (nextIsLastBlockInRound && direction === 'backward') {
      delete this.delegatesListCache[round + 1];
      // remove future cache.
      ops.push({
        model: this.delegatesRoundModel,
        options: {
          where: { round: { [Op.gte]: round + 1 } },
        },
        type: 'remove',
      });

      // Restore list cache from round.
      if (!this.delegatesListCache[round]) {
        const r = await this.delegatesRoundModel.findOne({
          where: { round },
        });
        this.delegatesListCache[round] = r.list;
      }
    } else if (
      (firstBlockInRound || newHeight === 2) &&
      direction === 'forward'
    ) {
      // Lets remove from cache rounds older than 10 to avoid unnecessary memory leaks.
      delete this.delegatesListCache[round - 10];

      // lets save oldRound in db. for faster recovery.
      ops.push({
        model: this.delegatesRoundModel,
        type: 'upsert',
        values: {
          list: this.delegatesListCache[round],
          round,
        },
      });
    }

    return ops;
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
      // Try restore from DB Cache
      const cachedList = await this.delegatesRoundModel.findOne({
        where: { round },
      });
      if (cachedList) {
        this.delegatesListCache[round] = cachedList.list;
      }
    }
    if (!this.delegatesListCache[round]) {
      // regenerate.
      const isV2 = this.dposV2Helper.isV2(height);
      const excludedList: Buffer[] = [];

      // In DPOS v2, the last delegate to forge a round, totally skips the next one.
      if (isV2) {
        const block = await this.getLastBlockInPrevRound(height);
        excludedList.push(block.generatorPublicKey);
      }
      let delegates = await this.getFilteredDelegatesSortedByVoteForForging(
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
          return {
            ...delegate,
            // Weighted Random Sampling (Efraimidis, Spirakis, 2005)
            weight: this.calcV2Weight(generator.random(), delegate, round),
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
        currentSeed = Buffer.from(roundSeed.buffer);
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

  public async loadForgingPKByDelegate(sender: Address) {
    const r: Array<
      DelegatesModel & { 'tx.height': number }
    > = (await this.delegatesModel.findAll({
      include: [
        {
          attributes: ['height'],
          model: this.transactionsModel,
          where: {
            senderId: sender,
          },
        },
      ],
      raw: true,
    })) as any;

    // sort
    r.sort((a, b) => a['tx.height'] - b['tx.height']);
    return r.map((a) => ({
      forgingPK: a.forgingPK,
      height: a['tx.height'],
    }));
  }

  // tslint:disable-next-line max-line-length
  public async calcDelegateInfo(
    delegate: BaseDelegateData,
    orderedDelegates?: Array<{ cmb: number; username: string }>
  ) {
    if (!orderedDelegates) {
      orderedDelegates = await this.accountsModel.findAll({
        attributes: ['username', 'cmb'],
        order: this.order(),
        raw: true,
        where: { isDelegate: 1, vote: { [Op.gte]: delegate.vote } },
      });
    }

    // calculate approval
    const totalSupply = this.blockReward.calcSupply(
      this.blocksModule.lastBlock.height
    );
    const approval =
      parseInt(((delegate.vote * 10n ** 4n) / totalSupply).toString(), 10) /
      100;
    const productivity =
      Math.round(
        (Math.abs(
          100 -
            delegate.missedblocks /
              ((delegate.producedblocks + delegate.missedblocks) / 100)
        ) || 0) * 1e2
      ) / 1e2;

    const rankV1 =
      orderedDelegates.findIndex((a) => a.username === delegate.username) + 1;
    const rankV2 =
      orderedDelegates
        .filter(
          (a) => a.cmb <= this.dposConstants.dposv2.maxContinuousMissedBlocks
        )
        .findIndex((a) => a.username === delegate.username) + 1;

    return { rankV1, rankV2, approval, productivity };
  }

  public async getDelegate(username: string) {
    const delegate = await this.accountsModel.findOne({
      raw: true,
      where: { username },
    });
    if (!delegate) {
      return null;
    }
    return {
      account: delegate,
      forgingPKs: await this.loadForgingPKByDelegate(delegate.address),
    };
  }

  /**
   * Gets delegates and for each calculate rank approval and productivity.
   */
  public async getDelegates(
    query: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<BaseDelegateData[]> {
    if (!query) {
      throw new Error('Missing query argument');
    }

    const limit = Math.min(
      this.dposConstants.activeDelegates,
      query.limit || this.dposConstants.activeDelegates
    );
    const offset = query.offset || 0;
    return await this.accountsModel.findAll({
      attributes: [
        'address',
        'cmb',
        'forgingPK',
        'username',
        'vote',
        'votesWeight',
        'producedblocks',
        'missedblocks',
      ],
      limit,
      offset,
      order: this.order(),
      raw: true,
      where: {
        isDelegate: 1,
      },
    });
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
   * Calculates v2 weight based on roudn, vote, and rand value.
   * @param rand
   * @param delegate
   * @param round
   */
  protected calcV2Weight(
    rand: number,
    delegate: { publicKey: Buffer; vote: bigint },
    round: number
  ) {
    return rand ** (1e8 / parseInt(delegate.vote.toString(), 10));
  }

  /**
   * Get delegates public keys sorted by descending vote.
   */
  // tslint:disable-next-line max-line-length
  private async getFilteredDelegatesSortedByVoteForForging(
    height: number,
    exclusionList: Buffer[]
  ): Promise<Array<{ publicKey: Buffer; vote: bigint }>> {
    const filter: AccountFilterData<AccountsModelForDPOS> = {
      isDelegate: 1,
    };
    if (this.dposV2Helper.isV1(height)) {
      filter.sort = { vote: -1, forgingPK: 1 };
    } else {
      filter.sort = { votesWeight: -1 };
      filter.forgingPK = { [Op.notIn]: exclusionList || [] };
      filter.cmb = {
        [Op.lte]: this.dposConstants.dposv2.maxContinuousMissedBlocks,
      };
    }

    const poolSize = this.slots.getDelegatesPoolSize(height);
    if (poolSize !== -1) {
      filter.limit = poolSize;
    }
    const rows = await this.accountsModule.getAccounts(filter);

    // we need to use (up to prev round forginPKs).
    const round = this.roundsLogic.calcRound(height);
    const prevForgingKeys: Array<{
      forgingPK: Buffer & As<'publicKey'>;
      'tx.senderId': Address;
    }> = await this.delegatesModel.findAll<any>({
      attributes: ['forgingPK'],
      include: [
        {
          attributes: ['senderId'],
          model: this.transactionsModel,
          where: {
            height: {
              [round === 1 ? Op.lte : Op.lt]: this.roundsLogic.firstInRound(
                round
              ),
            },
            senderId: rows.map((r) => r.address),
          },
        },
      ],
      order: [sequelize.literal('"tx"."height" ASC')],
      raw: true,
    });

    const correctFKByAddr: { [addr: string]: Buffer & As<'publicKey'> } = {};
    // Since it's ordered by height ASC, we know for sure that most recent
    // entry will be the one set here.
    for (const fk of prevForgingKeys) {
      correctFKByAddr[fk['tx.senderId']] = fk.forgingPK;
    }

    const sortingParam = this.dposV2Helper.isV1(height)
      ? 'vote'
      : 'votesWeight';
    return rows
      .sort((a, b) => {
        if (a[sortingParam] === b[sortingParam]) {
          return a.forgingPK.compare(b.forgingPK);
        } else if (a[sortingParam] < b[sortingParam]) {
          return 1;
        } else {
          return -1;
        }
      })
      .map((r) => ({
        publicKey: correctFKByAddr[r.address],
        vote: this.dposV2Helper.isV2(height) ? r.votesWeight : r.vote,
      }));
  }

  /**
   * Checks vote integrity for account and controls total votes do not exceed active delegates.
   * @param {AccountsModel} account
   * @param addedVotes
   * @param removedVotes
   * @param state
   * @return {Promise<void>}
   */
  private async checkDelegates(
    account: AccountsModelForDPOS,
    addedVotes: string[],
    removedVotes: string[],
    state: 'confirmed' | 'unconfirmed'
  ) {
    if (!account) {
      throw new Error('Account not found');
    }

    const delegates: string[] =
      (state === 'confirmed' ? account.delegates : account.u_delegates) || [];
    const existingVotes = Array.isArray(delegates) ? delegates.length : 0;

    const additions = addedVotes.length;
    const removals = removedVotes.length;

    for (const vote of addedVotes) {
      if (delegates.indexOf(vote) !== -1) {
        throw new Error(
          'Failed to add vote, account has already voted for this delegate'
        );
      }
      // check voted is actually a delegate.
      const del = await this.accountsModule.getAccount({
        isDelegate: 1,
        username: vote,
      });
      if (!del) {
        throw new Error('Delegate not found');
      }
    }

    for (const vote of removedVotes) {
      if (delegates.indexOf(vote) === -1) {
        throw new Error(
          'Failed to remove vote, account has not voted for this delegate'
        );
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
              [Op.lt]: height,
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

  private order(): OrderItem[] {
    return this.dposV2Helper.isV1()
      ? [['vote', 'DESC'], ['forgingPK', 'ASC']]
      : [['votesWeight', 'DESC'], ['forgingPK', 'ASC']];
  }
}
