import {
  IBlocksModule,
  ILogger,
  ITimeToEpoch,
  Symbols,
} from '@risevision/core-interfaces';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { BlocksConstantsType } from '../blocksConstants';
import { BlocksSymbols } from '../blocksSymbols';

@injectable()
export class BlocksModule implements IBlocksModule {
  public lastBlock: SignedAndChainedBlockType;

  @inject(BlocksSymbols.constants)
  private blocksConstants: BlocksConstantsType;

  @inject(Symbols.helpers.timeToEpoch)
  private timeToEpoch: ITimeToEpoch;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  public isStale(): boolean {
    if (!this.lastBlock) {
      return true;
    }

    const lastBlockTime = this.timeToEpoch.fromTimeStamp(
      this.lastBlock.timestamp
    );
    const lastBlockAge = Math.floor((Date.now() - lastBlockTime) / 1000);
    if (lastBlockAge > this.blocksConstants.staleAgeThreshold) {
      return true;
    }

    return false;
  }

  public cleanup() {
    return Promise.resolve();
  }
}
