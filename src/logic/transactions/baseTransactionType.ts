import { TransactionType } from '../../helpers/';
import { SignedBlockType } from '../block';

export interface IBaseTransaction<T> {
  type: TransactionType;
  amount: number;
  senderId?: string;
  senderPublicKey: string;
  requesterPublicKey?: string;
  timestamp: number;
  asset: T;
  recipientId: string;
  signature: string;
  id: string;
  fee: number;
  signatures?: string[];
  signSignature?: string;
}

export interface IConfirmedTransaction<T> extends IBaseTransaction<T> {
  blockId: string;
  height: number;
  senderId: string;
  recipientPublicKey?: string;
  confirmations?: number;
}

const emptyBuffer = new Buffer(0);

/**
 * Describes a Base Transaction Object
 */
export abstract class BaseTransactionType<T> {

  constructor(private txType: TransactionType) {
  }

  public get type(): TransactionType {
    return this.txType;
  }

  public abstract calculateFee(tx: IBaseTransaction<T>, sender: any, height: number): number;

  public verify(tx: IBaseTransaction<T>, sender: any): Promise<void> {
    return Promise.resolve();
  }

  public process(tx: IBaseTransaction<T>, sender: any): Promise<void> {
    return Promise.resolve();
  }

  public getBytes(tx: IBaseTransaction<T>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    return emptyBuffer;
  }

  public apply(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: any): Promise<void> {
    return Promise.resolve();
  }

  public applyUnconfirmed(tx: IBaseTransaction<T>, sender: any): Promise<void> {
    return Promise.resolve();
  }

  public undo(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: any): Promise<void> {
    return Promise.resolve();
  }

  public undoUnconfirmed(tx: IBaseTransaction<T>, sender: any): Promise<void> {
    return Promise.resolve();
  }

  public abstract objectNormalize(tx: IBaseTransaction<T>): IBaseTransaction<T>;

  public abstract dbRead(raw: any): T;

  public abstract dbSave(tx: IConfirmedTransaction<T> & { senderId: string }): { table: string, fields: string[], values: any };

  public afterSave(tx: IBaseTransaction<T>): Promise<void> {
    return Promise.resolve();
  }

  public ready(tx: IBaseTransaction<T>, sender: any): boolean {
    if (Array.isArray(sender.multisignatures) && sender.multisignatures.length) {
      if (!Array.isArray(tx.signatures)) {
        return false;
      }
      return tx.signatures.length >= sender.multimin;
    } else {
      return true;
    }
  }

}