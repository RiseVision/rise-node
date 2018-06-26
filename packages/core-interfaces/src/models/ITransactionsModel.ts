import { ITransportTransaction, publicKey, TransactionType } from '@risevision/core-types';
import { IBlocksModule } from '../modules';
import { IBaseModel } from './IBaseModel';

export interface ITransactionsModel<Asset = any> extends IBaseModel<ITransactionsModel<Asset>> {

  id: string;

  rowId: number;

  height: number;

  blockId: string;

  type: TransactionType;

  timestamp: number;

  senderPublicKey: Buffer;

  senderId: string;

  recipientId: string;

  amount: number;

  fee: number;
  signature: Buffer;
  signSignature: Buffer;

  requesterPublicKey: Buffer;

  asset: Asset;

  signatures: publicKey[];

  toTransport(bm: IBlocksModule): ITransportTransaction<Asset>;
}
