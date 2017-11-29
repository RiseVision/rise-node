import * as crypto from 'crypto';
import { IDatabase } from 'pg-promise';
import sql from '../../sql/delegates';
import {
  catchToLoggerAndRemapError,
  constants,
  Ed,
  ForkType,
  IKeypair,
  ILogger,
  JobsQueue,
  OrderBy,
  Sequence,
  Slots,
  TransactionType
} from '../helpers/';
import { BlockRewardLogic, MemAccountsData, SignedBlockType, TransactionLogic } from '../logic/';
import { RegisterDelegateTransaction } from '../logic/transactions/';
import { publicKey } from '../types/sanityTypes';
import { AccountsModule } from './accounts';
import { BlocksModule } from './blocks';
import { LoaderModule } from './loader';
import { RoundsModule } from './rounds';
import { TransactionsModule } from './transactions';
import { TransportModule } from './transport';
import { AppConfig } from '../types/genericTypes';
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
    transaction: TransactionLogic
  },
  config: AppConfig
};

export class DelegatesModule {
  public enabledKeys: { [k: string]: true }   = {};
  private blockReward: BlockRewardLogic       = new BlockRewardLogic();
  private delegateRegistrationTx: RegisterDelegateTransaction;
  private keypairs: { [k: string]: IKeypair } = {};
  private loaded: boolean                     = false;
  private modules: {
    blocks: BlocksModule,
    accounts: AccountsModule
    rounds: RoundsModule,
    loader: LoaderModule,
    transport: TransportModule,
    transactions: TransactionsModule,
  };

  constructor(public library: DelegatesModuleLibrary) {
    this.delegateRegistrationTx = this.library.logic.transaction.attachAssetType(
      TransactionType.DELEGATE,
      new RegisterDelegateTransaction({ schema: this.library.schema })
    );
  }

  public async checkConfirmedDelegates(pk: publicKey, votes: string[]) {
    return this.checkDelegates(pk, votes, 'confirmed');
  }

  public async checkUnconfirmedDelegates(pk: publicKey, votes: string[]) {
    return this.checkDelegates(pk, votes, 'unconfirmed');
  }

  /**
   * enable forging for specific pk or all if pk is undefined
   */
  public enableForge(pk?: publicKey | IKeypair) {
    let thePK: publicKey;
    if (typeof(pk) === 'object') {
      thePK                = pk.publicKey.toString('hex');
      this.keypairs[thePK] = pk;
    } else {
      thePK = pk;
    }

    Object.keys(this.keypairs)
      .filter((p) => typeof(thePK) === 'undefined' || p === thePK)
      .forEach((p) => this.enabledKeys[p] = true);
  }

  /**
   * disable forging for specific pk or all if pk is undefined
   */
  public disableForge(pk?: publicKey) {
    Object.keys(this.keypairs)
      .filter((p) => typeof(pk) === 'undefined' || p === pk)
      .forEach((p) => delete this.enabledKeys[p]);
  }

  /**
   * Inserts a fork into fork_stats table and emits a socket signal with the fork data
   * @param {SignedBlockType} block
   * @param {ForkType} cause
   * @return {Promise<void>}
   */
  public async fork(block: SignedBlockType, cause: ForkType) {
    this.library.logger.info('Fork', {
      block   : { id: block.id, timestamp: block.timestamp, height: block.height, previousBlock: block.previousBlock },
      cause,
      delegate: block.generatorPublicKey,
    });

    const fork = {
      blockHeight      : block.height,
      blockId          : block.id,
      blockTimestamp   : block.timestamp,
      cause,
      delegatePublicKey: block.generatorPublicKey,
      previousBlock    : block.previousBlock,
    };

    await this.library.db.none(sql.insertFork, fork);
    this.library.io.sockets.emit('delegates/fork', fork);
  }

  /**
   * Generate a randomized list for the round of which the given height is into.
   * @param {number} height blockheight.
   * @return {Promise<publicKey[]>}
   */
  public async generateDelegateList(height: number): Promise<publicKey[]> {
    const pkeys      = await this.getKeysSortByVote();
    const seedSource = this.modules.rounds.calcRound(height).toString();
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
        sort      : { vote: -1, publicKey: 1 },
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
        ... { rank, approval, productivity },
      });
    }

    const orderBy = OrderBy(query.orderBy, { quoteField: false });

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
  public async validateBlockSlot(block: SignedBlockType) {
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
      accounts    : scope.accounts,
      blocks      : scope.blocks,
      loader      : scope.loader,
      rounds      : scope.rounds,
      transactions: scope.transactions,
      transport   : scope.transport,
      // delegates   : scope.delegates,
    };

    this.delegateRegistrationTx.bind(this.modules.accounts, scope.system);
  }

  public async onBlockchainReady() {
    this.loaded = true;
    await this.loadDelegates();
    JobsQueue.register(
      'delegatesNextForge',
      async (cb) => {
        try {
          await this.forge();
          await this.modules.transactions.fillPool();
        } finally {
          cb();
        }
      },
      1000);
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
      sort      : { vote: -1, publicKey: 1 },
    }, ['publicKey']);
    return rows.map((r) => r.publicKey);
  }

  /**
   *  Gets slot time and keypair of a forging enabled account
   *  returns null if no slots are found for any of the forging acounts.
   */
  private async getBlockSlotData(slot: number, height: number): Promise<{ time: number, keypair: IKeypair }> {
    const pkeys = await this.generateDelegateList(height);

    const lastSlot = Slots.getLastSlot(slot);

    for (let cs = slot; cs < lastSlot; cs++) {
      const delegPos = cs % Slots.delegates;
      const delegId  = pkeys[delegPos];
      if (delegId && this.enabledKeys[delegId]) {
        return {
          keypair: this.keypairs[delegId],
          time   : Slots.getSlotTime(cs),
        };
      }
    }

    return null;

  }

  /**
   * Checks loading status, loads keypairs from config,
   * check if we're in slot, checks consensus and generates a block
   * @return {Promise<void>}
   */
  private async forge() {
    if (!this.loaded || this.modules.loader.isSyncing ||
      !this.modules.rounds.isLoaded() || this.modules.rounds.isTicking()) {

      this.library.logger.debug('Client not ready to forge');
      return;
    }

    // Check if delegates were loaded. and if not load delegates
    if (Object.keys(this.keypairs).length === 0) {
      await this.loadDelegates();

      // If still no keypairs then no delegates were enabled.
      if (Object.keys(this.keypairs).length === 0) {
        this.library.logger.debug('No delegates enabled');
        return;
      }
    }

    const currentSlot = Slots.getSlotNumber();
    const lastBlock   = this.modules.blocks.lastBlock;
    if (currentSlot === Slots.getSlotNumber(lastBlock.timestamp)) {
      this.library.logger.debug('Waiting for next delegate slot');
      return;
    }

    const blockData = await this.getBlockSlotData(currentSlot, lastBlock.height + 1);
    if (blockData === null) {
      this.library.logger.warn('Skipping delegate slot');
      return;
    }

    if (Slots.getSlotNumber(blockData.time) !== Slots.getSlotNumber()) {
      // not current slot. skip
      this.library.logger.debug(`Delegate slot ${Slots.getSlotNumber()}`);
      return;
    }

    await this.library.sequence.addAndPromise(async () => {
      // updates consensus.
      await this.modules.transport.getPeers({ limit: constants.maxPeers });

      if (this.modules.transport.poorConsensus) {
        throw new Error(`Inadequate broadhash consensus ${this.modules.transport.consensus} %`);
      }

      // ok lets generate, save and broadcast the block
      await this.modules.blocks.process.generateBlock(blockData.keypair, blockData.time);

    })
      .catch(catchToLoggerAndRemapError('Failed to generate block within delegate slot', this.library.logger));

  }

  /**
   * Checks vote integrity for account and controls total votes do not exceed active delegates.
   * @param {publicKey} pk
   * @param votes
   * @param state
   * @return {Promise<void>}
   */
  private async checkDelegates(pk: publicKey, votes: string[], state: 'confirmed' | 'unconfirmed') {
    const account = await this.modules.accounts.getAccount({ publicKey: pk });

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

      if (!this.library.schema.validate(curPK, { format: 'publicKey', type: 'string' })) {
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
      const del = await this.modules.accounts.getAccount({ publicKey: curPK, isDelegate: 1 });
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

  /**
   * Loads delegats from config and stores it on the private keypairs variable>
   */
  private async loadDelegates() {
    const secrets: string[] = this.library.config.forging.secret;
    if (!secrets || !secrets.length) {
      return;
    }
    this.library.logger.info(`Loading ${secrets.length} delegates from config`);

    for (const secret of secrets) {
      const keypair = this.library.ed.makeKeypair(crypto.createHash('sha256').update(secret, 'utf8').digest());
      const account = await this.modules.accounts.getAccount({ publicKey: keypair.publicKey.toString('hex') });
      if (!account) {
        throw new Error(`Account with publicKey: ${keypair.publicKey.toString('hex')} not found`);
      }

      if (account.isDelegate) {
        this.keypairs[keypair.publicKey.toString('hex')] = keypair;
        this.library.logger.info(`Forging enabled on account ${account.address}`);
      } else {
        this.library.logger.warn(`Account with public Key: ${account.publicKey} is not a delegate`);
      }
    }
    // Enable forging for all accounts
    this.enableForge();
  }
}
