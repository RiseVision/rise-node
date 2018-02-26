import { inject, injectable } from 'inversify';
import { constants as constantsType, ILogger, wait } from '../helpers/';
import { IBlocksModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { SignedAndChainedBlockType } from '../logic/';

// TODO Eventually remove this module and use appState instead.
@injectable()
export class BlocksModule implements IBlocksModule {
  public isActive   = false;
  public isCleaning = false;
  public lastBlock: SignedAndChainedBlockType;
  public lastReceipt: { get: () => number, isStale: () => boolean, update: (time?: number) => void };
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  private internalLastReceipt: number;
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
        return (secondsAgo > this.constants.blockReceiptTimeOut);
      },
      update : (time: number = Math.floor(Date.now() / 1000)) => {
        this.internalLastReceipt = time;
      },
    };
  }

  public async cleanup() {
    this.isCleaning = true;
    while (this.isActive) {
      this.logger.info('Waiting for block processing to finish');
      await wait(1000);
    }
  }

}
