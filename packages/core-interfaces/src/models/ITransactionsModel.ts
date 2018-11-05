import {
  ITransportTransaction,
  publicKey,
  TransactionType,
} from '@risevision/core-types';
import { IBaseTransaction } from '../../../core-types/dist';
import { IBlocksModule } from '../modules';
import { IBaseModel } from './IBaseModel';

export class ITransactionsModel<Asset = any> extends IBaseModel<
  ITransactionsModel<Asset>
> {
  public static toTransportTransaction<Asset>(
    t: IBaseTransaction<Asset>
  ): ITransportTransaction<Asset> & { confirmations?: number } {
    return null;
  }
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

  public signatures: Buffer[];

  public toTransport(): ITransportTransaction<Asset> {
    return null;
  }
}
