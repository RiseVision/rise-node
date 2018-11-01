import { inject, injectable } from 'inversify';
import { constants as constantsType, TransactionType } from '../../helpers/';
import { Symbols } from '../../ioc/symbols';
import { AccountsModel } from '../../models/';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';
import { ISlots } from '../../ioc/interfaces/helpers';

@injectable()
export class RegisterDelegateTransaction extends BaseTransactionType<void, null> {
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.helpers.slots)
  private slots: ISlots;

  constructor() {
    super(TransactionType.ROUNDSEED);
  }

  public calculateFee(tx: IBaseTransaction<void>, sender: AccountsModel, height: number): number {
    return 0;
  }

  public getBytes(tx: IBaseTransaction<void>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    return null;
  }

  public fromBytes(bytes: Buffer, tx: IBaseTransaction<any>): null {
    return null;
  }

  public async verify(tx: IBaseTransaction<void>, sender: AccountsModel): Promise<void> {
    // Timestamp must be a multiple of blockTime AND numDelegates
    if (tx.timestamp % this.slots.delegates !== 0 || tx.timestamp % this.constants.blockTime !== 0) {
      throw new Error('Invalid timestamp');
    }
    if (tx.amount !== 0) {
      throw new Error('Invalid amount');
    }
    if (typeof tx.recipientId !== 'undefined' && tx.recipientId !== null) {
      throw new Error('Invalid recipientId');
    }

    if (typeof tx.recipientId !== 'undefined' && tx.requesterPublicKey !== null) {
      throw new Error('Invalid requesterPublicKey');
    }

    if (typeof tx.asset !== 'undefined' && tx.asset !== null) {
      throw new Error('Invalid asset');
    }
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
