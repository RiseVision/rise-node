import {TransactionType} from '../../helpers/transactionTypes';

export interface IBaseTransaction<T> {
  type: TransactionType;
  amount: number;
  senderPublicKey: string;
  requesterPublicKey?: string;
  timestamp: number;
  asset: T;
  recipientId: string;
  signature: string;
  id: string;
  fee: number;
}

/**
 * Describes a Base Transaction Object
 */
export abstract class BaseTransactionLogic<T> {

  public abstract apply(tx: IBaseTransaction<T>, )
}