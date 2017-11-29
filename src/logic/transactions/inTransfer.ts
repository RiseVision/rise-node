import dappSql from '../../../sql/logic/transactions/dapps';
import {cbToPromise, ILogger, TransactionType} from '../../helpers/';
import {AccountsModule, RoundsModule, SystemModule} from '../../modules/';
import inTransferSchema from '../../schema/logic/transactions/inTransfer';
import {SignedBlockType} from '../block';
import {BaseTransactionType, IBaseTransaction, IConfirmedTransaction} from './baseTransactionType';

// tslint:disable-next-line interface-over-type-literal
export type InTransferAsset = {
  inTransfer: {
    dappId: string;
  }
};

export class InTranferTransaction extends BaseTransactionType<InTransferAsset> {

  public modules: { accounts: AccountsModule, rounds: RoundsModule, sharedApi: any, system: SystemModule };
  private dbTable  = 'intransfer';
  private dbFields = [
    'dappId',
    'transactionId',
  ];

  constructor(public library: { db: any, logger: ILogger, schema: any, network: any }) {
    super(TransactionType.IN_TRANSFER);
  }

  public bind(accounts: any, rounds: any, sharedApi: any, system: any) {
    this.modules = { accounts, rounds, sharedApi, system };
  }

  public calculateFee(tx: IBaseTransaction<InTransferAsset>, sender: any, height: number): number {
    return this.modules.system.getFees(height).fees.send;
  }

  public getBytes(tx: IBaseTransaction<InTransferAsset>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    return Buffer.from(tx.asset.inTransfer.dappId, 'utf8');
  }

  public async verify(tx: IBaseTransaction<InTransferAsset>, sender: any): Promise<void> {
    if (tx.recipientId) {
      throw new Error('Invalid recipient');
    }

    if (tx.amount !== 0) {
      throw new Error('Invalid transaction amount');
    }

    if (!tx.asset || !tx.asset.inTransfer) {
      throw new Error('Invalid transaction asset');
    }

    return this.library.db.one(
      dappSql.countByTransactionId,
      {
        id: tx.asset.inTransfer.dappId,
      }
    ).then((row) => {
      if (row.count === 0) {
        throw new Error(`Application not found: ${tx.asset.inTransfer.dappId}`);
      }
    });
  }

  public apply(tx: IConfirmedTransaction<InTransferAsset>, block: SignedBlockType, sender: any): Promise<void> {
    return cbToPromise<any>((cb) => this.modules.sharedApi.getGenesis({ dappid: tx.asset.inTransfer.dappId }, cb))
      .then((res) => this.modules.accounts.mergeAccountAndGet(
        {
          address  : res.authorId,
          balance  : tx.amount,
          blockId  : block.id,
          round    : this.modules.rounds.calcRound(block.height),
          u_balance: tx.amount,
        })
      )
      .then(() => void 0);
  }

  public undo(tx: IConfirmedTransaction<InTransferAsset>, block: SignedBlockType, sender: any): Promise<void> {
    return cbToPromise<any>((cb) => this.modules.sharedApi.getGenesis({ dappid: tx.asset.inTransfer.dappId }, cb))
      .then((res) => this.modules.accounts.mergeAccountAndGet(
        {
          address  : res.authorId,
          balance  : -tx.amount,
          blockId  : block.id,
          round    : this.modules.rounds.calcRound(block.height),
          u_balance: -tx.amount,
        }
      ))
      .then(() => void 0);
  }

  public objectNormalize(tx: IBaseTransaction<InTransferAsset>): IBaseTransaction<InTransferAsset> {
    const report = this.library.schema.validate(tx.asset.inTransfer, inTransferSchema);
    if (!report) {
      throw new Error(`Failed to validate inTransfer schema: ${this.library.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
    }

    return tx;
  }

  public dbRead(raw: any): InTransferAsset {
    if (!raw.in_dappId) {
      return null;
    } else {
      return { inTransfer: { dappId: raw.in_dappId } };
    }
  }

  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<InTransferAsset> & { senderId: string }): { table: string; fields: string[]; values: any } {
    // tslint:disable object-literal-sort-keys
    return {
      table : this.dbTable,
      fields: this.dbFields,
      values: {
        dappId       : tx.asset.inTransfer.dappId,
        transactionId: tx.id,
      },
    };
    // tslint:enable object-literal-sort-keys
  }

}
