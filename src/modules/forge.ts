import * as crypto from 'crypto';
import { inject, injectable, tagged } from 'inversify';
import { catchToLoggerAndRemapError, constants, Ed, IKeypair, ILogger, JobsQueue, Sequence, Slots } from '../helpers';
import { IAppState, IBroadcasterLogic } from '../ioc/interfaces/logic';
import {
  IAccountsModule, IBlocksModule, IBlocksModuleProcess, IDelegatesModule, IForgeModule,
  ITransactionsModule
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { AppConfig } from '../types/genericTypes';
import { publicKey } from '../types/sanityTypes';

@injectable()
export class ForgeModule implements IForgeModule {
  public enabledKeys: { [k: string]: true }   = {};
  private keypairs: { [k: string]: IKeypair } = {};

  // Generic
  @inject(Symbols.generic.appConfig)
  private config: AppConfig;

  // helpers
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.ed)
  private ed: Ed;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.defaultSequence)
  private sequence: Sequence;
  @inject(Symbols.helpers.slots)
  private slots: Slots;

  // logic
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: IBroadcasterLogic;

  // modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.blocksSubModules.process)
  private blocksProcessModule: IBlocksModuleProcess;

  public getEnabledKeys() {
    return Object.keys(this.enabledKeys)
      .filter((pk) => this.enabledKeys[pk] === true);
  }

  public isForgeEnabledOn(pk?: publicKey | IKeypair) {
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
    const thePK: publicKey = pk.publicKey.toString('hex');
    this.keypairs[thePK] = pk;

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

  public onBlockchainReady() {
    JobsQueue.register(
      'delegatesNextForge',
      async () => {
        try {
          await this.forge();
          await this.transactionsModule.fillPool();
        } catch (err) {
          this.logger.warn('Error in nextForge', err);
        }
      },
      1000);
  }

  /**
   * Checks loading status, loads keypairs from config,
   * check if we're in slot, checks consensus and generates a block
   * @return {Promise<void>}
   */
  private async forge() {
    if (this.appState.get('loader.isSyncing') ||
      !this.appState.get('rounds.isLoaded') ||
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

    await this.sequence.addAndPromise(async () => {
      // updates consensus.
      await this.broadcasterLogic.getPeers({ limit: constants.maxPeers });

      if (this.appState.getComputed('node.poorConsensus')) {
        throw new Error(`Inadequate broadhash consensus ${this.appState
          .getComputed('node.poorConsensus')} %`);
      }

      // ok lets generate, save and broadcast the block
      await this.blocksProcessModule.generateBlock(blockData.keypair, blockData.time);

    })
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
      const keypair = this.ed.makeKeypair(crypto.createHash('sha256').update(secret, 'utf8').digest());
      const account = await this.accountsModule.getAccount({ publicKey: keypair.publicKey.toString('hex') });
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
   *  returns null if no slots are found for any of the forging acounts.
   */
  private async getBlockSlotData(slot: number, height: number): Promise<{ time: number, keypair: IKeypair }> {
    const pkeys = await this.delegatesModule.generateDelegateList(height);

    const lastSlot = this.slots.getLastSlot(slot);

    for (let cs = slot; cs < lastSlot; cs++) {
      const delegPos = cs % this.slots.delegates;
      const delegId  = pkeys[delegPos];
      if (delegId && this.enabledKeys[delegId]) {
        return {
          keypair: this.keypairs[delegId],
          time   : this.slots.getSlotTime(cs),
        };
      }
    }

    return null;

  }

}
