import { Column, DataType, HasMany, Model, PrimaryKey, Scopes, Table } from 'sequelize-typescript';
import { SignedBlockType } from '../logic';
import { TransactionsModel } from './TransactionsModel';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

@Table({tableName: 'blocks'})
export class BlocksModel extends Model<BlocksModel> {

  constructor(values?: FilteredModelAttributes<BlocksModel>, options?: IBuildOptions) {
    super(values, options);
    if (this.TransactionsModel == null) {
      this.transactions = [];
    } else {
      this.transactions = this.TransactionsModel.sort((a, b) => a.rowId - b.rowId);
    }
  }

  @PrimaryKey
  @Column
  public id: string;

  @Column
  public rowId: number;

  @Column
  public version: number;

  @Column
  public timestamp: number;

  @Column
  public height: number;

  @Column
  public previousBlock: string;

  @Column
  public numberOfTransactions: number;

  @Column
  public totalAmount: number;

  @Column
  public totalFee: number;

  @Column
  public reward: number;

  @Column
  public payloadLength: number;

  @Column(DataType.BLOB)
  public payloadHash: Buffer;

  @Column(DataType.BLOB)
  public generatorPublicKey: Buffer;

  @Column(DataType.BLOB)
  public blockSignature: Buffer;

  public transactions: TransactionsModel[];

  // tslint:disable-next-line
  @HasMany(() => TransactionsModel, {as: "TransactionsModel"})
  private TransactionsModel: TransactionsModel[];

  // tslint:disable member-ordering
  public static classFromPOJO(pojo: SignedBlockType): BlocksModel {
    const toRet = new this();
    Object.keys(pojo).forEach((k) => toRet[k] = pojo[k]);
    return toRet;
  }
}
