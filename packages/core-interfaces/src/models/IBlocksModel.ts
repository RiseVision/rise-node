import { IBaseModel } from './IBaseModel';
import { ITransactionsModel } from './ITransactionsModel';

export class IBlocksModel extends IBaseModel<IBlocksModel> {
  public id: string;
  public rowId: number;
  public version: number;
  public timestamp: number;
  public height: number;
  public previousBlock: string;
  public numberOfTransactions: number;
  public totalAmount: number;
  public totalFee: number;
  public reward: number;
  public payloadLength: number;
  public payloadHash: Buffer;
  public generatorPublicKey: Buffer;
  public blockSignature: Buffer;
  public transactions: ITransactionsModel[];
}
