import { IBlocksModel } from '../models';
import { IModule } from './IModule';

export interface IBlocksModule extends IModule {
  lastReceipt: { get: () => number, isStale: () => boolean, update: (time?: number) => void };
  lastBlock: IBlocksModel;
}
