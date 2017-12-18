import { inject, injectable } from 'inversify';
import { TransactionType } from '../../helpers/';
import { IRoundsLogic } from '../../ioc/interfaces/logic';
import { IAccountsModule, ISystemModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { SignedBlockType } from '../block';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';

@injectable()
export class SendTransaction extends BaseTransactionType<void> {

  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  constructor() {
    super(TransactionType.SEND);
  }

  public calculateFee(tx: IBaseTransaction<void>, sender: any, height: number): number {
    return this.systemModule.getFees(height).fees.send;
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
    await this.accountsModule.setAccountAndGet({ address: tx.recipientId });

    return this.accountsModule.mergeAccountAndGet({
      address  : tx.recipientId,
      balance  : tx.amount,
      blockId  : block.id,
      round    : this.roundsLogic.calcRound(block.height),
      u_balance: tx.amount,
    })
      .then(() => void 0);
  }

  public async undo(tx: IConfirmedTransaction<void>, block: SignedBlockType, sender: any): Promise<void> {
    // Create account if does not exist.
    await this.accountsModule.setAccountAndGet({ address: tx.recipientId });

    return this.accountsModule.mergeAccountAndGet({
      address  : tx.recipientId,
      balance  : -tx.amount,
      blockId  : block.id,
      round    : this.roundsLogic.calcRound(block.height),
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
