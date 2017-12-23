import { inject, injectable } from 'inversify';
import { constants, ILogger, wait } from '../helpers/';
import { Symbols } from '../ioc/symbols';
import { SignedAndChainedBlockType } from '../logic/';

// TODO Eventually remove this module and use appState instead.
@injectable()
export class BlocksModule {
  public lastReceipt: { get: () => number, isStale: () => boolean, update: (time?: number) => void };
  public isActive   = false;
  public lastBlock: SignedAndChainedBlockType;
  public isCleaning = false;
  private internalLastReceipt: number;
  private loaded    = false;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  constructor() {
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
      update : (time: number = Math.floor(Date.now() / 1000)) => {
        this.internalLastReceipt = time;
      },
    };
  }

  public async onBind(): Promise<void> {
    this.loaded  = true;
  }

  public async cleanup() {
    this.loaded     = false;
    this.isCleaning = true;
    while (this.isActive) {
      this.logger.info('Waiting for block processing to finish');
      await wait(10000);
    }
  }

  public isLoaded() {
    return this.loaded;
  }

}
