import {
  Address,
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

  public senderPubData: Buffer;

  public senderId: Address;

  public recipientId: Address;

  public amount: bigint;

  public fee: bigint;

  public asset: Asset;

  public signatures: Buffer[];

  public version: number;

  public toTransport(): ITransportTransaction<Asset> {
    return null;
  }
}
