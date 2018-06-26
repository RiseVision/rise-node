import { ForkType } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export class IForkStatsModel extends IBaseModel<IForkStatsModel> {
  public delegatePublicKey: Buffer;

  public blockTimestamp: number;

  public blockId: string;

  public blockHeight: number;

  public previousBlock: string;

  public cause: ForkType;
}
