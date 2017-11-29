import { constants, ILogger, wait } from '../helpers/';
import { SignedAndChainedBlockType } from '../logic/';
import { BlocksModuleChain, BlocksModuleProcess, BlocksModuleUtils, BlocksModuleVerify } from './blocks/';

export class BlocksModule {
  public lastReceipt: { get: () => number, isStale: () => boolean, update: () => void };
  public isActive   = false;
  public lastBlock: SignedAndChainedBlockType;
  public isCleaning = false;
  private modules: {
    chain: BlocksModuleChain,
    process: BlocksModuleProcess,
    utils: BlocksModuleUtils,
    verify: BlocksModuleVerify,
  };
  private internalLastReceipt: number;
  private loaded    = false;

  constructor(private library: {
    logger: ILogger
  }) {
    this.lastReceipt = {
      get    : () => this.internalLastReceipt,
      isStale: () => {
        if (!this.internalLastReceipt) {
          return true;
        }
        // Current time in seconds - lastReceipt (seconds)
        const secondsAgo = Math.floor(Date.now() / 1000) - this.internalLastReceipt;
        return (secondsAgo > constants.blockReceiptTimeOut);
      },
      update : () => {
        this.internalLastReceipt = Math.floor(Date.now() / 1000);
      },
    };
  }

  public async onBind(subModules: any): Promise<void> {
    this.modules = {
      chain  : subModules.blocksChain,
      process: subModules.blocksProcess,
      utils  : subModules.blocksUtils,
      verify : subModules.blocksVerify,
    };
    this.loaded  = true;
  }

  public async cleanup() {
    this.loaded     = false;
    this.isCleaning = true;
    while (this.isActive) {
      this.library.logger.info('Waiting for block processing to finish');
      await wait(10000);
    }
  }

  public isLoaded() {
    return this.loaded;
  }

  get verify() {
    return this.modules.verify;
  }

  get process() {
    return this.modules.process;
  }

  get utils() {
    return this.modules.utils;
  }

  get chain(): BlocksModuleChain {
    return this.modules.chain;
  }

}
