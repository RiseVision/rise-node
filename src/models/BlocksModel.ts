import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { SignedBlockType } from '../logic';
import { TransactionsModel } from './TransactionsModel';
import { IConfirmedTransaction } from '../logic/transactions';

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
  public transactions: TransactionsModel[] = null;
  public async populateTransactions(): Promise<TransactionsModel[]> {
    if (this.transactions === null) {
      this.transactions = await TransactionsModel.findAll({where: {blockId: this.id}});
    }
    return this.transactions;
  }

  // tslint:disable member-ordering
  public static classFromPOJO(pojo: SignedBlockType): BlocksModel {
    const toRet = new this();
    Object.keys(pojo).forEach((k) => toRet[k] = pojo[k]);
    return toRet;
  }
}
//
// const bit = new TransactionsModel();
// const b: IConfirmedTransaction<any> = bit;
