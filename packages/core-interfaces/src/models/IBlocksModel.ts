import { SignedBlockType } from '@risevision/core-types';
import { IBlocksModule } from '../modules';
import { IBaseModel } from './IBaseModel';
import { ITransactionsModel } from './ITransactionsModel';

export class IBlocksModel extends IBaseModel<IBlocksModel> {
  public static toStringBlockType(
    b: SignedBlockType
  ): SignedBlockType<string, string> {
    throw new Error('Not implemented. Please implement in subclass');
  }

  public id: string;
  public rowId: number;
  public version: number;
  public timestamp: number;
  public height: number;
  public previousBlock: string;
  public numberOfTransactions: number;
  public totalAmount: bigint;
  public totalFee: bigint;
  public reward: bigint;
  public payloadLength: number;
  public payloadHash: Buffer;
  public generatorPublicKey: Buffer;
  public blockSignature: Buffer;
  public transactions: ITransactionsModel[];
}
