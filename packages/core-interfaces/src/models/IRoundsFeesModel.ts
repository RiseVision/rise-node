import { IBaseModel } from './IBaseModel';

export interface IRoundsFeesModel extends IBaseModel<IRoundsFeesModel> {
  height: number;

  fees: number;

  timestamp: number;

  publicKey: Buffer;
}
