import { IBlocksModule, ILogger, Symbols } from '@risevision/core-interfaces';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import {
  ConstantsType,
  SignedAndChainedBlockType,
} from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { BlocksConstantsType } from '../blocksConstants';

// TODO Eventually remove this module and use appState instead.
@injectable()
export class BlocksModule implements IBlocksModule {
  public lastBlock: SignedAndChainedBlockType;
  public lastReceipt: {
    get: () => number;
    isStale: () => boolean;
    update: (time?: number) => void;
  };
  @inject(Symbols.generic.constants)
  private constants: BlocksConstantsType;
  private internalLastReceipt: number;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  constructor() {
    this.lastReceipt = {
      get: () => this.internalLastReceipt,
      isStale: () => {
        if (!this.internalLastReceipt) {
          return true;
        }
        // Current time in seconds - lastReceipt (seconds)
        const secondsAgo =
          Math.floor(Date.now() / 1000) - this.internalLastReceipt;
        return secondsAgo > this.constants.blocks.receiptTimeOut;
      },
      update: (time: number = Math.floor(Date.now() / 1000)) => {
        this.internalLastReceipt = time;
      },
    };
  }

  public cleanup() {
    return Promise.resolve();
  }
}
