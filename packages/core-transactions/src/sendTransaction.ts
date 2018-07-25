import {
  IAccountLogic,
  IAccountsModel,
  IAccountsModule,
  ISystemModule, Symbols
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  DBOp,
  IBaseTransaction,
  IConfirmedTransaction,
  SignedBlockType,
  TransactionType
} from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import { BaseTx } from './BaseTx';

@injectable()
export class SendTransaction extends BaseTx<void, null> {

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;

  constructor() {
    super(TransactionType.SEND);
  }

  public calculateFee(tx: IBaseTransaction<void>, sender: IAccountsModel, height: number): number {
    return this.systemModule.getFees(height).fees.send;
  }

  public async verify(tx: IBaseTransaction<void>, sender: IAccountsModel): Promise<void> {
    if (!tx.recipientId) {
      throw new Error('Missing recipient');
    }

    if (tx.amount <= 0) {
      throw new Error('Invalid transaction amount');
    }
  }

  public async apply(tx: IConfirmedTransaction<void>,
                     block: SignedBlockType, sender: IAccountsModel): Promise<Array<DBOp<any>>> {
    return await this.hookSystem.apply_filters('core-transactions/send-tx/apply/ops', [
      ... this.accountLogic.merge(tx.recipientId, {
        balance  : tx.amount,
        blockId  : block.id,
        // round    : this.roundsLogic.calcRound(block.height),
        u_balance: tx.amount,
      }),
    ], tx, block, sender);
  }

  // tslint:disable-next-line max-line-length
  public async undo(tx: IConfirmedTransaction<void>, block: SignedBlockType, sender: IAccountsModel): Promise<Array<DBOp<any>>> {
    return await this.hookSystem.apply_filters('core-transactions/send-tx/undo/ops', [
      ... this.accountLogic.merge(tx.recipientId, {
        balance  : -tx.amount,
        blockId  : block.id,
        // round    : this.roundsLogic.calcRound(block.height),
        u_balance: -tx.amount,
      }),
    ], tx, block, sender);
  }

  public objectNormalize(tx: IBaseTransaction<void>): IBaseTransaction<void> {
    return tx;
  }

  public dbRead(raw: any): void {
    return null;
  }

  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<void> & { senderId: string }) {
    return null;
  }

}
