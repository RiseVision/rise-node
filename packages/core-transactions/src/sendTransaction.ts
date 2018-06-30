import { Symbols } from '@risevision/core-helpers';
import {
  IAccountLogic,
  IAccountsModel,
  IAccountsModule,
  IRoundsLogic,
  ISystemModule
} from '@risevision/core-interfaces';
import {
  DBOp,
  IBaseTransaction,
  IConfirmedTransaction,
  SignedBlockType,
  TransactionType
} from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { BaseTx } from './BaseTx';

@injectable()
export class SendTransaction extends BaseTx<void, null> {

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(Symbols.models.accounts)
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
    return [
      ... this.accountLogic.merge(tx.recipientId, {
        balance  : tx.amount,
        blockId  : block.id,
        round    : this.roundsLogic.calcRound(block.height),
        u_balance: tx.amount,
      }),
    ];
  }

  public async undo(tx: IConfirmedTransaction<void>, block: SignedBlockType, sender: IAccountsModel): Promise<Array<DBOp<any>>> {
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
