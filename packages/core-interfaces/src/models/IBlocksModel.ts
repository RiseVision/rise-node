import { IBaseModel } from './IBaseModel';
import { ITransactionsModel } from './ITransactionsModel';

export class IBlocksModel extends IBaseModel<IBlocksModel> {
  id: string;

  rowId: number;

  version: number;

  timestamp: number;

  height: number;

  previousBlock: string;

  numberOfTransactions: number;

  totalAmount: number;

  totalFee: number;

  reward: number;

  payloadLength: number;

  payloadHash: Buffer;

  generatorPublicKey: Buffer;

  blockSignature: Buffer;

  transactions: ITransactionsModel[];

}
