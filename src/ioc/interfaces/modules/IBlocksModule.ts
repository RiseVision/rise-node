import { IModule } from './IModule';
import { SignedAndChainedBlockType } from '../../../logic';

export interface IBlocksModule extends IModule {
  lastReceipt: { get: () => number, isStale: () => boolean, update: (time?: number) => void };
  lastBlock: SignedAndChainedBlockType;
}
