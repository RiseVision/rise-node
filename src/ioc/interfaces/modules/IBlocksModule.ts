import {  SignedAndChainedBlockType } from '../../../logic';
import { IModule } from './IModule';

export interface IBlocksModule extends IModule {
  lastReceipt: { get: () => number, isStale: () => boolean, update: () => void };
  lastBlock: SignedAndChainedBlockType;
  isActive: boolean;
  isCleaning: boolean;
}
