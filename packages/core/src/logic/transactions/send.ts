import { inject, injectable } from 'inversify';
import { TransactionType } from '../../helpers/';
import { IAccountLogic, IRoundsLogic } from '../../ioc/interfaces/logic';
import { IAccountsModule, ISystemModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { AccountsModel } from '../../models';
import { DBOp } from '../../types/genericTypes';
import { SignedBlockType } from '../block';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';

@injectable()
export class SendTransaction extends BaseTransactionType<void, null> {

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;

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

  public async apply(tx: IConfirmedTransaction<void>,
                     block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return [
      ... this.accountLogic.merge(tx.recipientId, {
        balance  : tx.amount,
        blockId  : block.id,
        round    : this.roundsLogic.calcRound(block.height),
        u_balance: tx.amount,
      }),
    ];
  }

  public async undo(tx: IConfirmedTransaction<void>, block: SignedBlockType, sender: any): Promise<Array<DBOp<any>>> {
    return [
      ... this.accountLogic.merge(tx.recipientId, {
        balance  : -tx.amount,
        blockId  : block.id,
        round    : this.roundsLogic.calcRound(block.height),
        u_balance: -tx.amount,
      }),
    ];
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
