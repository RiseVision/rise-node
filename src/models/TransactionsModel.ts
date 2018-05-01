import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { TransactionType } from '../helpers';

@Table({ tableName: 'trs' })
export class TransactionsModel extends Model<TransactionsModel> {
  @PrimaryKey
  @Column
  public id: string;

  @Column
  public rowId: number;

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

  @Column
  public signatures: string;
  // @Column
  // public get signatures(): string[] {
  //   return this.getDataValue('signatures').join(',');
  // }
  //
  // public set signatures(value: string[]) {
  //   this.setDataValue('signatures', Array.isArray(value) ? value.join(',') : value);
  // }
}
