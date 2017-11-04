import {TransactionType} from '../../helpers/transactionTypes';
import {BlockType, SignedBlockType} from '../block';

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

  public abstract calculateFee(tx: IBaseTransaction<T>, sender: any, height: number): number;

  public abstract verify(tx: IBaseTransaction<T>, sender: any): Promise<void>;

  public abstract process(tx: IBaseTransaction<T>, sender: any): Promise<void>;

  public getBytes(tx: IBaseTransaction<T>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    return emptyBuffer;
  }

  public abstract apply(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: any): Promise<void>;

  public abstract applyUnconfirmed(tx: IBaseTransaction<T>, sender: any): Promise<void>;

  public abstract undo(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: any): Promise<void>;

  public abstract undoUnconfirmed(tx: IBaseTransaction<T>, sender: any): Promise<void>;

  public abstract objectNormalize(tx: IBaseTransaction<T>): IBaseTransaction<T>;

  public abstract dbRead(raw: any): T;

  public abstract dbSave(tx: IConfirmedTransaction<T> & {senderId: string}): { table: string, fields: string[], values: any };

  public abstract afterSave(tx: IBaseTransaction<T>): Promise<void>;

  public abstract ready(tx: IBaseTransaction<T>, sender: any): boolean;


}