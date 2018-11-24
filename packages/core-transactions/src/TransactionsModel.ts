import {
  IBlocksModule,
  ITransactionsModel,
  Symbols,
} from '@risevision/core-interfaces';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import {
  IBaseTransaction,
  ITransportTransaction,
  TransactionType,
} from '@risevision/core-types';
import {
  Column,
  DataType,
  ForeignKey,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

@Table({ tableName: 'trs' })
// tslint:disable-next-line max-line-length
export class TransactionsModel<Asset = any>
  extends BaseModel<TransactionsModel<Asset>>
  implements ITransactionsModel<Asset> {
  @Column(DataType.BLOB)
  public get signatures(): Buffer[] {
    if (this.getDataValue('signatures')) {
      return this.getDataValue('signatures').split(',');
    }
    return [];
  }

  public set signatures(value: Buffer[]) {
    this.setDataValue(
      'signatures',
      Array.isArray(value)
        ? value.map((s: Buffer) => s.toString('hex')).join(',')
        : value
    );
  }

  public static toTransportTransaction<Asset>(
    t: IBaseTransaction<Asset>
  ): ITransportTransaction<Asset> & { confirmations?: number } {
    const blocksModule: IBlocksModule = this.container.get(
      Symbols.modules.blocks
    );
    let obj;
    if (t instanceof TransactionsModel) {
      obj = { ...t.toJSON(), asset: t.asset };
    } else {
      obj = { ...t };
    }
    [
      'requesterPublicKey',
      'senderPublicKey',
      'signSignature',
      'signature',
    ].forEach((k) => {
      if (typeof obj[k] !== 'undefined' && obj[k] !== null) {
        obj[k] = obj[k].toString('hex');
      }
    });
    if (obj.height) {
      obj.confirmations = 1 + blocksModule.lastBlock.height - obj.height;
    }
    if (typeof obj.amount === 'bigint') {
      obj.amount = `${obj.amount}`;
    }
    if (typeof obj.fee === 'bigint') {
      obj.fee = `${obj.fee}`;
    }
    return obj as any;
  }
  @PrimaryKey
  @Column
  public id: string;

  @Column
  public rowId: number;

  @Column
  public height: number;

  @ForeignKey(() =>
    this.TransactionsModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.blocks
    )
  )
  @Column
  public blockId: string;

  @Column(DataType.INTEGER)
  public type: TransactionType;

  @Column
  public timestamp: number;

  @Column(DataType.BLOB)
  public senderPublicKey: Buffer;

  @Column
  public senderId: string;

  @Column
  public recipientId: string;

  @Column
  public amount: bigint;

  @Column
  public fee: bigint;

  @Column(DataType.BLOB)
  public signature: Buffer;

  @Column(DataType.BLOB)
  public signSignature: Buffer;

  @Column(DataType.BLOB)
  public requesterPublicKey: Buffer;

  public asset: Asset = null;

  constructor(
    values?: FilteredModelAttributes<TransactionsModel<Asset>>,
    options?: IBuildOptions
  ) {
    super(values, options);
    if (values && values.asset) {
      this.asset = values.asset as any;
    }
  }

  public toTransport(): ITransportTransaction<Asset> {
    return TransactionsModel.toTransportTransaction(this);
  }
}
