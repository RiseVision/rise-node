import { ITransportTransaction, publicKey, TransactionType } from '@risevision/core-types';
import { IBlocksModule } from '../modules';
import { IBaseModel } from './IBaseModel';
import { IBaseTransaction } from '../../../core-types/dist';

export class ITransactionsModel<Asset = any> extends IBaseModel<ITransactionsModel<Asset>> {

  public id: string;

  public rowId: number;

  public height: number;

  public blockId: string;

  public type: TransactionType;

  public timestamp: number;

  public senderPublicKey: Buffer;

  public senderId: string;

  public recipientId: string;

  public amount: number;

  public fee: number;
  public signature: Buffer;
  public signSignature: Buffer;

  public requesterPublicKey: Buffer;

  public asset: Asset;

  public signatures: publicKey[];

  public toTransport(bm: IBlocksModule): ITransportTransaction<Asset> {
    return null;
  }

  public static toTransportTransaction<Asset>(t: IBaseTransaction<Asset>, blocksModule: IBlocksModule): ITransportTransaction<Asset> & { confirmations?: number } {
    return null;
  }
}