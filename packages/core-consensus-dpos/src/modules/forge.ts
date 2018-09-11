import { BlocksModuleProcess, BlocksSymbols } from '@risevision/core-blocks';
import {
  IAccountsModule,
  IAppState,
  IBlocksModule,
  ICrypto,
  IJobsQueue,
  ILogger,
  IModule, ISequence,
  ITransactionsModule, Symbols
} from '@risevision/core-interfaces';
import { BroadcasterLogic } from '@risevision/core-p2p';
import { ConstantsType, IKeypair, publicKey } from '@risevision/core-types';
import { catchToLoggerAndRemapError, WrapInDefaultSequence } from '@risevision/core-utils';
import * as crypto from 'crypto';
import { inject, injectable, named } from 'inversify';
import { DposAppConfig, dPoSSymbols, Slots } from '../helpers/';
import { AccountsModelForDPOS } from '../models';
import { DelegatesModule } from './delegates';

@injectable()
export class ForgeModule implements IModule {
  public enabledKeys: { [k: string]: true }   = {};
  private keypairs: { [k: string]: IKeypair } = {};

  // Generic
  @inject(Symbols.generic.appConfig)
  private config: DposAppConfig;

  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  // helpers
  @inject(Symbols.generic.crypto)
  private crypto: ICrypto;
  @inject(Symbols.helpers.jobsQueue)
  private jobsQueue: IJobsQueue;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.defaultSequence)
  public defaultSequence: ISequence;
  @inject(dPoSSymbols.helpers.slots)
  private slots: Slots;

  // logic
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: BroadcasterLogic;

  // modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule<AccountsModelForDPOS>;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(BlocksSymbols.modules.process)
  private blocksProcessModule: BlocksModuleProcess;
  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  public cleanup(): Promise<void> {
    this.jobsQueue.unregister('delegatesNextForge');
    return Promise.resolve();
  }

  public getEnabledKeys(): publicKey[] {
    return Object.keys(this.enabledKeys)
      .filter((pk) => this.enabledKeys[pk] === true);
  }

  public isForgeEnabledOn(pk?: publicKey | IKeypair): boolean {
    let thePK: publicKey;
    if (typeof(pk) === 'object') {
      thePK                = pk.publicKey.toString('hex');
      this.keypairs[thePK] = pk;
    } else {
      thePK = pk;
    }
    return this.enabledKeys[thePK] === true;
  }

  /**
   * enable forging for specific pk or all if pk is undefined
   */
  public enableForge(pk?: IKeypair) {
    const thePK: publicKey = typeof(pk) !== 'undefined' ? pk.publicKey.toString('hex') : undefined;
    if (typeof thePK !== 'undefined') {
      this.keypairs[thePK] = pk;
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

  public async onBlockchainReady() {
    setTimeout(() => {
      this.jobsQueue.register(
        'delegatesNextForge',
        () => this.delegatesNextForge(),
        1000);
    }, 10000); // Register forging routine after 10seconds that blockchain is ready.
  }

  @WrapInDefaultSequence
  private async delegatesNextForge() {
    try {
      await this.transactionsModule.fillPool();
      await this.forge();
    } catch (err) {
      this.logger.warn('Error in nextForge', err);
    }
  }

  /**
   * Checks loading status, loads keypairs from config,
   * check if we're in slot, checks consensus and generates a block
   * @return {Promise<void>}
   */
  private async forge() {
    if (this.appState.get('loader.isSyncing') ||
      this.appState.get('rounds.isTicking')) {

      this.logger.debug('Client not ready to forge');
      return;
    }

    // Check if delegates were loaded. and if not load delegates
    if (Object.keys(this.keypairs).length === 0) {
      await this.loadDelegates();

      // If still no keypairs then no delegates were enabled.
      if (Object.keys(this.keypairs).length === 0) {
        this.logger.debug('No delegates enabled');
        return;
      }
    }

    const currentSlot = this.slots.getSlotNumber();
    const lastBlock   = this.blocksModule.lastBlock;
    if (currentSlot === this.slots.getSlotNumber(lastBlock.timestamp)) {
      this.logger.debug('Waiting for next delegate slot');
      return;
    }

    const blockData = await this.getBlockSlotData(currentSlot, lastBlock.height + 1);
    if (blockData === null) {
      this.logger.warn('Skipping delegate slot');
      return;
    }

    if (this.slots.getSlotNumber(blockData.time) !== this.slots.getSlotNumber()) {
      // not current slot. skip
      this.logger.debug(`Delegate slot ${this.slots.getSlotNumber()}`);
      return;
    }

    // NOTE: This is wrapped in a default sequence because it's called only from delegatesNextForge

    // updates consensus.
    await this.broadcasterLogic.getPeers({ limit: this.constants.maxPeers });

    if (this.appState.getComputed('node.poorConsensus')) {
      throw new Error(`Inadequate broadhash consensus ${this.appState
        .get('node.consensus')} %`);
    }

    // ok lets generate, save and broadcast the block
    await this.blocksProcessModule.generateBlock(blockData.keypair, blockData.time)
      .catch(catchToLoggerAndRemapError('Failed to generate block within delegate slot', this.logger));

  }

  /**
   * Loads delegats from config and stores it on the private keypairs variable>
   */
  private async loadDelegates() {
    const secrets: string[] = this.config.forging.secret;
    if (!secrets || !secrets.length) {
      return;
    }
    this.logger.info(`Loading ${secrets.length} delegates from config`);

    for (const secret of secrets) {
      const keypair = this.crypto.makeKeyPair(crypto.createHash('sha256').update(secret, 'utf8').digest());
      const account = await this.accountsModule.getAccount({ publicKey: keypair.publicKey });
      if (!account) {
        throw new Error(`Account with publicKey: ${keypair.publicKey.toString('hex')} not found`);
      }

      if (account.isDelegate) {
        this.keypairs[keypair.publicKey.toString('hex')] = keypair;
        this.logger.info(`Forging enabled on account ${account.address}`);
      } else {
        this.logger.warn(`Account with public Key: ${account.publicKey} is not a delegate`);
      }
    }
    // Enable forging for all accounts
    this.enableForge();
  }

  /**
   *  Gets slot time and keypair of a forging enabled account
   *  returns null if no slots are found for any of the forging accounts.
   */
  private async getBlockSlotData(slot: number, height: number): Promise<{ time: number, keypair: IKeypair }> {
    const pkeys = await this.delegatesModule.generateDelegateList(height);

    const lastSlot = this.slots.getLastSlot(slot);

    for (let cs = slot; cs < lastSlot; cs++) {
      const delegPos = cs % this.slots.delegates;
      const delegId  = pkeys[delegPos];
      if (delegId && this.enabledKeys[delegId.toString('hex')]) {
        return {
          keypair: this.keypairs[delegId.toString('hex')],
          time   : this.slots.getSlotTime(cs),
        };
      }
    }

    return null;

  }

}
