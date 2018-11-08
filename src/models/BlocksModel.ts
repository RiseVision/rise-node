import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import * as _ from 'lodash';
import { SignedAndChainedBlockType, SignedBlockType } from '../logic';
import { TransactionsModel } from './TransactionsModel';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { IBlocksModule } from '../ioc/interfaces/modules';

@Table({ tableName: 'blocks' })
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
  public previousBlockIDSignature: Buffer;

  @Column(DataType.BLOB)
  public payloadHash: Buffer;

  @Column(DataType.BLOB)
  public generatorPublicKey: Buffer;

  @Column(DataType.BLOB)
  public blockSignature: Buffer;

  public transactions: TransactionsModel[];

  // tslint:disable-next-line
  @HasMany(() => TransactionsModel, { as: "TransactionsModel" })
  private TransactionsModel: TransactionsModel[];

  public toJSON(): SignedAndChainedBlockType {
    const toRet        = super.toJSON();
    toRet.transactions = (toRet.TransactionsModel || [])
      .map((t, idx) => {
        t.asset = this.transactions[idx].asset;
        return t;
      });
    return toRet;
  }

// tslint:disable member-ordering
  public static classFromPOJO(pojo: SignedBlockType): BlocksModel {
    const toRet = new this();
    Object.keys(pojo).forEach((k) => toRet[k] = pojo[k]);
    return toRet;
  }

  public static toStringBlockType(btmp: SignedBlockType, TxModel: typeof TransactionsModel, blocksModule: IBlocksModule): SignedBlockType<string> {
    const b   = _.cloneDeep(btmp instanceof BlocksModel ? btmp.toJSON() : btmp);
    const txs = (btmp.transactions || [])
      .map((t) => TxModel.toTransportTransaction(t, blocksModule));
    if (!Buffer.isBuffer(b.blockSignature) || !Buffer.isBuffer(b.generatorPublicKey) || !Buffer.isBuffer(b.payloadHash)) {
      throw new Error('toStringBlockType used with non Buffer block type');
    }
    const toRet = {
      ...b,
      blockSignature          : b.blockSignature.toString('hex'),
      generatorPublicKey      : b.generatorPublicKey.toString('hex'),
      payloadHash             : b.payloadHash.toString('hex'),
      previousBlockIDSignature: b.previousBlockIDSignature ? b.previousBlockIDSignature.toString('hex') : null,
      transactions            : txs as any,
    };
    return toRet;
  }
}
