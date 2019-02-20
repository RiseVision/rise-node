import { SignedAndChainedBlockType } from '../../types';
import { IModule } from './IModule';

export interface IBlocksModule extends IModule {
  lastBlock: SignedAndChainedBlockType;
  isStale(): boolean;
}
