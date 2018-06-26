import { IBaseModel } from './IBaseModel';

export class IRoundsFeesModel extends IBaseModel<IRoundsFeesModel> {
  public height: number;

  public fees: number;

  public timestamp: number;

  public publicKey: Buffer;
}
