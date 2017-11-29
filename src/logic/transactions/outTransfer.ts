import dappsSQL from '../../../sql/logic/transactions/dapps';
import {cbToPromise, ILogger, TransactionType} from '../../helpers/';
import {AccountsModule, RoundsModule, SystemModule} from '../../modules/';
import outTransferSchema from '../../schema/logic/transactions/outTransfer';
import {AccountLogic} from '../account';
import {SignedBlockType} from '../block';
import {BaseTransactionType, IBaseTransaction, IConfirmedTransaction} from './baseTransactionType';

// tslint:disable-next-line interface-over-type-literal
export type OutTransferAsset = {
  outTransfer: {
    dappId: string;
    transactionId: string;
  }
};

export class OutTransferTransaction extends BaseTransactionType<OutTransferAsset> {
  public modules: { accounts: AccountsModule, dapps: any, rounds: RoundsModule, system: SystemModule };

  private unconfirmedOutTransfers: { [txID: string]: true } = {};
  private dbTable                                           = 'outtransfer';
  private dbFields                                          = [
    'dappId',
    'outTransactionId',
    'transactionId',
  ];

  constructor(private library: { db: any, logger: ILogger, schema: any, account: AccountLogic }) {
    super(TransactionType.OUT_TRANSFER);
  }

  public bind(accounts: any, dapps: any, rounds: any, system: any) {
    this.modules = { accounts, dapps, rounds, system };
  }

  public calculateFee(tx: IBaseTransaction<OutTransferAsset>, sender: any, height: number): number {
    return this.modules.system.getFees(height).fees.send;
  }

  public async verify(tx: IBaseTransaction<OutTransferAsset> & { senderId: string }, sender: any): Promise<void> {
    if (!tx.recipientId) {
      throw new Error('Invalid recipient');
    }

    if (!tx.amount) {
      throw new Error('Invalid transaction amount');
    }

    if (!tx.asset || !tx.asset.outTransfer) {
      throw new Error('Invalid transaction asset');
    }

    if (!/^[0-9]+$/.test(tx.asset.outTransfer.dappId)) {
      throw new Error('Invalid outTransfer dappId');
    }

    if (!/^[0-9]+$/.test(tx.asset.outTransfer.transactionId)) {
      throw new Error('Invalid outTransfer transactionId');
    }
  }

  public async process(tx: IBaseTransaction<OutTransferAsset>, sender: any): Promise<void> {
    const row = await this.library.db.one(dappsSQL.countByTransactionId, {
      id: tx.asset.outTransfer.dappId, // TODO: Bug? should be transactionId
    });

    if (row.count === 0) {
      throw new Error(`Application not found ${tx.asset.outTransfer.dappId}`);
    }

    if (this.unconfirmedOutTransfers[tx.asset.outTransfer.transactionId]) {
      throw new Error(`Transaction is already processed: ${tx.asset.outTransfer.transactionId}`);
    }

    const txs = await this.library.db.one(dappsSQL.countByOutTransactionId, {
      transactionId: tx.asset.outTransfer.transactionId,
    });

    if (txs.count > 0) {
      throw new Error('Transaction is already confirmed');
    }
  }

  public getBytes(tx: IBaseTransaction<OutTransferAsset>, skipSignature: boolean, skipSecond: boolean): Buffer {
    return Buffer.concat([
      Buffer.from(tx.asset.outTransfer.dappId, 'utf8'),
      Buffer.from(tx.asset.outTransfer.transactionId, 'utf8'),
    ]);
  }

  public async apply(tx: IConfirmedTransaction<OutTransferAsset>, block: SignedBlockType,
                     sender: any): Promise<void> {
    delete this.unconfirmedOutTransfers[tx.asset.outTransfer.transactionId];

    // Create account if does not exist
    await this.modules.accounts.setAccountAndGet({ address: tx.recipientId });

    return this.modules.accounts.mergeAccountAndGet({
      address  : tx.recipientId,
      balance  : tx.amount,
      blockId  : block.id,
      round    : this.modules.rounds.calcRound(block.height),
      u_balance: tx.amount,
    })
      .then(() => void 0);
  }

  public async undo(tx: IConfirmedTransaction<OutTransferAsset>, block: SignedBlockType, sender: any): Promise<void> {
    this.unconfirmedOutTransfers[tx.asset.outTransfer.transactionId] = true;

    // Create account if does not exist
    await this.modules.accounts.setAccountAndGet({ address: tx.recipientId });

    return this.modules.accounts.mergeAccountAndGet({
      address  : tx.recipientId,
      balance  : -tx.amount,
      blockId  : block.id,
      round    : this.modules.rounds.calcRound(block.height),
      u_balance: -tx.amount,
    })
      .then(() => void 0);
  }

  public async applyUnconfirmed(tx: IBaseTransaction<OutTransferAsset>, sender: any): Promise<void> {
    this.unconfirmedOutTransfers[tx.asset.outTransfer.transactionId] = true;
  }

  public async undoUnconfirmed(tx: IBaseTransaction<OutTransferAsset>, sender: any): Promise<void> {
    delete this.unconfirmedOutTransfers[tx.asset.outTransfer.transactionId];
  }

  public objectNormalize(tx: IBaseTransaction<OutTransferAsset>): IBaseTransaction<OutTransferAsset> {
    const report = this.library.schema.validate(tx.asset, outTransferSchema);
    if (!report) {
      throw new Error(`Failed to validate outTransfer schema: ${this.library.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
    }

    return tx;
  }

  public dbRead(raw: any): OutTransferAsset {
    if (!raw.ot_dappId) {
      return null;
    }
    return {
      outTransfer: {
        dappId       : raw.ot_dappId,
        transactionId: raw.ot_outTransactionId,
      },
    };
  }

  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<OutTransferAsset> & { senderId: string }): { table: string; fields: string[]; values: any } {
    return {
      fields: this.dbFields,
      table : this.dbTable,
      values: {
        dappId          : tx.asset.outTransfer.dappId,
        outTransactionId: tx.asset.outTransfer.transactionId,
        transactionId   : tx.id,
      },
    };
  }

  public afterSave(tx: IBaseTransaction<OutTransferAsset>): Promise<void> {
    return cbToPromise<void>((cb) => this.modules.dapps.message(
      tx.asset.outTransfer.dappId,
      {
        message: { transactionId: tx.id },
        topic  : 'withdrawal',
      }
    ));
  }
}
