import { TransactionType } from '../../helpers/';
import { IRoundsLogic } from '../../ioc/interfaces/logic';
import { IAccountsModule, IRoundsModule, ISystemModule } from '../../ioc/interfaces/modules';
import { SignedBlockType } from '../block';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';

export class SendTransaction extends BaseTransactionType<void> {
  public modules: {
    accounts: IAccountsModule,
    system: ISystemModule
  };

  constructor(private library: { rounds: IRoundsLogic }) {
    super(TransactionType.SEND);
  }

  public bind(accounts: IAccountsModule, system: ISystemModule) {
    this.modules = { accounts, system };
  }

  public calculateFee(tx: IBaseTransaction<void>, sender: any, height: number): number {
    return this.modules.system.getFees(height).fees.send;
  }

  public async verify(tx: IBaseTransaction<void>, sender: any): Promise<void> {
    if (!tx.recipientId) {
      throw new Error('Missing recipient');
    }

    if (tx.amount <= 0) {
      throw new Error('Invalid transaction amount');
    }
  }

  public async apply(tx: IConfirmedTransaction<void>, block: SignedBlockType,
                     sender: any): Promise<void> {
    // Create account if does not exist.
    await this.modules.accounts.setAccountAndGet({ address: tx.recipientId });

    return this.modules.accounts.mergeAccountAndGet({
      address  : tx.recipientId,
      balance  : tx.amount,
      blockId  : block.id,
      round    : this.library.rounds.calcRound(block.height),
      u_balance: tx.amount,
    })
      .then(() => void 0);
  }

  public async undo(tx: IConfirmedTransaction<void>, block: SignedBlockType, sender: any): Promise<void> {
    // Create account if does not exist.
    await this.modules.accounts.setAccountAndGet({ address: tx.recipientId });

    return this.modules.accounts.mergeAccountAndGet({
      address  : tx.recipientId,
      balance  : -tx.amount,
      blockId  : block.id,
      round    : this.library.rounds.calcRound(block.height),
      u_balance: -tx.amount,
    })
      .then(() => void 0);
  }

  public objectNormalize(tx: IBaseTransaction<void>): IBaseTransaction<void> {
    return tx;
  }

  public dbRead(raw: any): void {
    return null;
  }

  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<void> & { senderId: string }): { table: string; fields: string[]; values: any } {
    return null;
  }

}
