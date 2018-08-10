import { IBlocksModel, IBlocksModule, ITransactionsModel, Symbols } from '@risevision/core-interfaces';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { SignedBlockType } from '@risevision/core-types';
import { Column, DataType, HasMany, PrimaryKey, Table } from 'sequelize-typescript';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

// tslint:disable member-ordering
@Table({ tableName: 'blocks' })
export class BlocksModel extends BaseModel<BlocksModel> implements IBlocksModel {

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

  // tslint:disable member-ordering
  public static classFromPOJO(pojo: SignedBlockType): BlocksModel {
    const toRet = new this();
    Object.keys(pojo).forEach((k) => toRet[k] = pojo[k]);
    return toRet;
  }

  public static toStringBlockType(b: SignedBlockType): SignedBlockType<string> {
    const TxModel      = this.container.getNamed<typeof ITransactionsModel>(
      ModelSymbols.model,
      Symbols.models.transactions
    );
    const BlocksModule = this.container.get<IBlocksModule>(Symbols.modules.blocks);

    const txs = (b.transactions || [])
      .map((t) => TxModel.toTransportTransaction(t, BlocksModule));
    if (
      !Buffer.isBuffer(b.blockSignature) || !Buffer.isBuffer(b.generatorPublicKey) ||
      !Buffer.isBuffer(b.payloadHash)
    ) {
      throw new Error('toStringBlockType used with non Buffer block type');
    }
    const toRet = {
      ...(b instanceof BlocksModel ? b.toJSON() : b),
      blockSignature    : b.blockSignature.toString('hex'),
      generatorPublicKey: b.generatorPublicKey.toString('hex'),
      payloadHash       : b.payloadHash.toString('hex'),
      transactions      : txs as any,
    };
    delete toRet.TransactionsModel;
    return toRet;
  }
}
