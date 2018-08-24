import { SignedAndChainedBlockType } from '@risevision/core-types';
import { IModule } from './IModule';

export interface IBlocksModule extends IModule {
  lastReceipt: { get: () => number, isStale: () => boolean, update: (time?: number) => void };
  lastBlock: SignedAndChainedBlockType;
}
