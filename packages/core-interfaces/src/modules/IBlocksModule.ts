import { SignedAndChainedBlockType } from '@risevision/core-types';
import { IModule } from './IModule';

export interface IBlocksModule extends IModule {
  lastBlock: SignedAndChainedBlockType;
  isStale(): boolean;
}
