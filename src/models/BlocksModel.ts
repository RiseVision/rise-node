import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { TransactionsModel } from './TransactionsModel';
import { SignedBlockType } from '../logic';

@Table({tableName: 'blocks'})
export class BlocksModel extends Model<BlocksModel> {
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

  // tslint:disable-next-line
  private _transactions: TransactionsModel[] = null;
  public async findTransactions(): Promise<TransactionsModel[]> {
    if (this._transactions === null) {
      this._transactions = await TransactionsModel.findAll({where: {blockId: this.id}});
    }
    return this._transactions;
  }

  public static classFromPOJO(pojo: SignedBlockType): BlocksModel {
    const toRet = new this();
    Object.keys(pojo).forEach((k) => toRet[k] = pojo[k]);
    return toRet;
  }
}
