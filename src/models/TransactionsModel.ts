import { Column, DataType, DefaultScope, ForeignKey, HasOne, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { TransactionType } from '../helpers';
import * as sequelize from 'sequelize';
import { MultiSignaturesModel } from './MultiSignaturesModel';
import { BlocksModel } from './BlocksModel';
import { IBaseTransaction, ITransportTransaction } from '../logic/transactions';
import { TransportModule } from '../modules';

const fields                 = ['id', 'rowId', 'blockId', 'type', 'timestamp', 'senderPublicKey', 'senderId', 'recipientId', 'amount', 'fee', 'signature', 'signSignature', 'requesterPublicKey'];
const buildArrayArgAttribute = function (table: string, what: string, alias?: string): any {
  return [sequelize.literal(`(SELECT "${what}" FROM ${table} WHERE "transactionId" = "TransactionsModel"."id")`), alias || what];
};

@DefaultScope({
  attributes: [
    ...fields,
    buildArrayArgAttribute('votes', 'votes'),
    buildArrayArgAttribute('signatures', 'publicKey', 'secondSignPublicKey'),
    buildArrayArgAttribute('delegates', 'username'),
  ],
  include   : [{
    model: () => MultiSignaturesModel,
  }],
})
@Table({ tableName: 'trs' })
export class TransactionsModel extends Model<TransactionsModel> {
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

  @Column(DataType.STRING)
  public get signatures(): string[] {
    return (this.getDataValue('signatures') || []).join(',');
  }

  public set signatures(value: string[]) {
    this.setDataValue('signatures', Array.isArray(value) ? value.join(',') : value);
  }

  @HasOne(() => MultiSignaturesModel)
  private multisigData: MultiSignaturesModel;

  @Column
  private username: string;

  @Column
  private votes: string;

  @Column(DataType.BLOB)
  private secondSignPublicKey: Buffer;

  public get asset() {
    switch (this.type) {
      case TransactionType.DELEGATE:
        return { delegate: { username: this.username } };
      case TransactionType.VOTE:
        return { votes: this.votes ? this.votes.split(',') : [] };
      case TransactionType.MULTI:
        return {
          multisignature: {
            min      : this.multisigData.min,
            lifetime : this.multisigData.lifetime,
            keysgroup: this.multisigData.keysgroup.split(','),
          },
        };
      case TransactionType.SIGNATURE:
        return { signature: { publicKey: this.secondSignPublicKey.toString('hex') } };
      default:
        return {};
    }
  }

  public toTransport<T>(): ITransportTransaction<T> {
    return TransactionsModel.toTransportTransaction(this);
  }

  public static toTransportTransaction<T>(t: IBaseTransaction<any>): ITransportTransaction<T> {
    const obj = {... t};
    ['requesterPublicKey', 'senderPublicKey', 'signSignature', 'signature']
      .forEach((k) => {
        if (typeof(obj[k]) !== 'undefined') {
          obj[k] = obj[k].toString('hex');
        }
      });
    return obj as any;
  }

}
