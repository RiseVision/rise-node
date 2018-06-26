import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { TransactionType } from '../helpers';
import { IBlocksModule } from '../ioc/interfaces/';
import { IBaseTransaction, ITransportTransaction } from '../logic/transactions';
import { BlocksModel } from './BlocksModel';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

@Table({ tableName: 'trs' })
export class TransactionsModel<Asset = any> extends Model<TransactionsModel<Asset>> {

  @PrimaryKey
  @Column
  public id: string;

  @Column
  public rowId: number;

  @Column
  public height: number;

  @ForeignKey(() => BlocksModel)
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
  public amount: number;

  @Column
  public fee: number;

  @Column(DataType.BLOB)
  public signature: Buffer;

  @Column(DataType.BLOB)
  public signSignature: Buffer;

  @Column(DataType.BLOB)
  public requesterPublicKey: Buffer;

  constructor(values?: FilteredModelAttributes<TransactionsModel<Asset>>, options?: IBuildOptions) {
    super(values, options);
    if (values && values.asset) {
      this.asset = values.asset as any;
    }
  }

  @Column(DataType.STRING)
  public get signatures(): string[] {
    if (this.getDataValue('signatures')) {
      return this.getDataValue('signatures').split(',');
    }
    return [];
  }

  public set signatures(value: string[]) {
    this.setDataValue('signatures', Array.isArray(value) ? value.join(',') : value);
  }

  public asset: Asset = null;

  public toTransport(blocksModule: IBlocksModule): ITransportTransaction<Asset> {
    return TransactionsModel.toTransportTransaction(this, blocksModule);
  }

  public static toTransportTransaction<Asset>(t: IBaseTransaction<Asset>, blocksModule: IBlocksModule): ITransportTransaction<Asset> & { confirmations?: number } {
    let obj;
    if (t instanceof TransactionsModel) {
      obj = { ... t.toJSON(), asset: t.asset };
    } else {
      obj = { ...t };
    }
    ['requesterPublicKey', 'senderPublicKey', 'signSignature', 'signature']
      .forEach((k) => {
        if (typeof(obj[k]) !== 'undefined' && obj[k] !== null) {
          obj[k] = obj[k].toString('hex');
        }
      });
    if (obj.height) {
      obj.confirmations = 1 + blocksModule.lastBlock.height - obj.height;
    }
    return obj as any;
  }

}
