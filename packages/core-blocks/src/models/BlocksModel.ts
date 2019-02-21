import { ITransactionsModel, Symbols } from '@risevision/core-interfaces';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { SignedBlockType } from '@risevision/core-types';
import { toTransportable } from '@risevision/core-utils';
import * as _ from 'lodash';
import {
  Column,
  DataType,
  HasMany,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

@Table({ tableName: 'blocks' })
export class BlocksModel extends BaseModel<BlocksModel> {
  public static toStringBlockType(
    btmp: SignedBlockType
  ): SignedBlockType<string, string> {
    const TxModel = this.container.getNamed<typeof ITransactionsModel>(
      ModelSymbols.model,
      Symbols.models.transactions
    );
    const b = _.cloneDeep(btmp instanceof BlocksModel ? btmp.toJSON() : btmp);
    const txs = (btmp.transactions || []).map((t) =>
      TxModel.toTransportTransaction(t)
    );

    delete b.transactions;
    delete b.TransactionsModel;
    const toRet = toTransportable(b);
    toRet.transactions = txs;
    return toRet;
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

  @Column(DataType.BIGINT)
  public totalAmount: bigint;

  @Column(DataType.BIGINT)
  public totalFee: bigint;

  @Column(DataType.BIGINT)
  public reward: bigint;

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
  @HasMany(
    () =>
      this.BlocksModel.container.getNamed(
        ModelSymbols.model,
        Symbols.models.transactions
      ),
    { as: 'TransactionsModel' }
  )
  private TransactionsModel: ITransactionsModel[];
  constructor(
    values?: FilteredModelAttributes<BlocksModel>,
    options?: IBuildOptions
  ) {
    super(values, options);
    if (this.TransactionsModel == null) {
      this.transactions = [];
    } else {
      this.transactions = this.TransactionsModel.sort(
        (a, b) => a.rowId - b.rowId
      );
    }
  }
}
