import * as crypto from 'crypto';
import { catchToLoggerAndRemapError, constants, Ed, IKeypair, ILogger, JobsQueue, Sequence, Slots } from '../helpers';
import { IAppState, IBroadcasterLogic } from '../ioc/interfaces/logic';
import {
  IAccountsModule, IBlocksModule, IBlocksModuleProcess, IDelegatesModule,
  IForgeModule, ITransactionsModule
} from '../ioc/interfaces/modules';
import { AppConfig } from '../types/genericTypes';
import { publicKey } from '../types/sanityTypes';

export class ForgeModule implements IForgeModule {
  public enabledKeys: { [k: string]: true }   = {};
  private keypairs: { [k: string]: IKeypair } = {};
  private modules: {
    accounts: IAccountsModule,
    blocks: IBlocksModule,
    delegates: IDelegatesModule,
    transactions: ITransactionsModule
    blocksProcess: IBlocksModuleProcess,
  };

  constructor(private library: {
    logger: ILogger,
    sequence: Sequence,
    config: AppConfig,
    ed: Ed,
    logic: {
      appState: IAppState,
      broadcaster: IBroadcasterLogic,
    }
  }) {
  }

  public onBind(modules: {
    accounts: IAccountsModule,
    blocks: IBlocksModule,
    delegates: IDelegatesModule,
    transactions: ITransactionsModule
    blocksProcess: IBlocksModuleProcess,
  }) {
    this.modules = {
      accounts     : modules.accounts,
      blocks       : modules.blocks,
      blocksProcess: modules.blocksProcess,
      delegates    : modules.delegates,
      transactions : modules.transactions,
    };
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

  public onBlockchainReady() {
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

  /**
   * Checks loading status, loads keypairs from config,
   * check if we're in slot, checks consensus and generates a block
   * @return {Promise<void>}
   */
  private async forge() {
    if (this.library.logic.appState.get('loader.isSyncing') ||
      !this.library.logic.appState.get('rounds.isLoaded') ||
      this.library.logic.appState.get('rounds.isTicking')) {

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
      await this.library.logic.broadcaster.getPeers({limit: constants.maxPeers});

      if (this.library.logic.appState.getComputed('node.poorConsensus')) {
        throw new Error(`Inadequate broadhash consensus ${this.library.logic.appState
          .getComputed('node.poorConsensus')} %`);
      }

      // ok lets generate, save and broadcast the block
      await this.modules.blocksProcess.generateBlock(blockData.keypair, blockData.time);

    })
      .catch(catchToLoggerAndRemapError('Failed to generate block within delegate slot', this.library.logger));

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
      const account = await this.modules.accounts.getAccount({publicKey: keypair.publicKey.toString('hex')});
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

  /**
   *  Gets slot time and keypair of a forging enabled account
   *  returns null if no slots are found for any of the forging acounts.
   */
  private async getBlockSlotData(slot: number, height: number): Promise<{ time: number, keypair: IKeypair }> {
    const pkeys = await this.modules.delegates.generateDelegateList(height);

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

}
