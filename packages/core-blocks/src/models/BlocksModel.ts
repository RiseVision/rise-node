import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import * as _ from 'lodash';
import { SignedBlockType } from '../logic';
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
  public payloadHash: Buffer;

  @Column(DataType.BLOB)
  public generatorPublicKey: Buffer;

  @Column(DataType.BLOB)
  public blockSignature: Buffer;

  public transactions: ITransactionsModel[];

  // tslint:disable-next-line
  @HasMany(() => this.BlocksModel.container.getNamed(ModelSymbols.model, Symbols.models.transactions), { as: "TransactionsModel" })
  private TransactionsModel: ITransactionsModel[];

  public static toStringBlockType(btmp: SignedBlockType, TxModel: typeof TransactionsModel, blocksModule: IBlocksModule): SignedBlockType<string> {
    const b = _.cloneDeep(btmp instanceof BlocksModel ? btmp.toJSON() : btmp);
    const txs = (btmp.transactions || [])
      .map((t) => TxModel.toTransportTransaction(t, blocksModule));
    if (!Buffer.isBuffer(b.blockSignature) || !Buffer.isBuffer(b.generatorPublicKey) || !Buffer.isBuffer(b.payloadHash)) {
      throw new Error('toStringBlockType used with non Buffer block type');
    }
    const toRet = {
      ...(b instanceof BlocksModel ? b.toJSON() : b),
      blockSignature    : b.blockSignature.toString('hex'),
      transactions      : txs as any,
      generatorPublicKey: b.generatorPublicKey.toString('hex'),
      payloadHash       : b.payloadHash.toString('hex'),
    };
    delete toRet.TransactionsModel;
    return toRet;
  }
}
