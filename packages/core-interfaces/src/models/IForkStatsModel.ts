import { ForkType } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export interface IForkStatsModel extends IBaseModel<IForkStatsModel> {
  delegatePublicKey: Buffer;

  blockTimestamp: number;

  blockId: string;

  blockHeight: number;

  previousBlock: string;

  cause: ForkType;
}
