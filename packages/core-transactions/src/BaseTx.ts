import {
  IAccountsModel,
  IBaseTransactionType,
} from '@risevision/core-interfaces';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import {
  DBOp,
  IBaseTransaction,
  SignedBlockType,
  TransactionType,
} from '@risevision/core-types';
import { inject, injectable, unmanaged } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { Model } from 'sequelize-typescript';
import { TxReadyFilter } from './hooks/filters';

const emptyBuffer = new Buffer(0);

/**
 * Describes a Base Transaction Object
 */
@injectable()
export abstract class BaseTx<T, M extends Model<any>>
  implements IBaseTransactionType<T, M> {
  @inject(LaunchpadSymbols.hookSystem)
  protected hookSystem: WordPressHookSystem;

  constructor(@unmanaged() private txType: TransactionType) {}

  public get type(): TransactionType {
    return this.txType;
  }

  public abstract calculateFee(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel,
    height: number
  ): bigint;

  public verify(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel
  ): Promise<void> {
    return Promise.resolve();
  }

  public getBytes(
    tx: IBaseTransaction<T>,
    skipSignature: boolean,
    skipSecondSignature: boolean
  ): Buffer {
    return emptyBuffer;
  }

  /**
   * Returns asset, given Buffer containing it
   */
  public fromBytes(bytes: Buffer, tx: IBaseTransaction<any>): T {
    return null;
  }

  public apply(
    tx: IBaseTransaction<T>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  public applyUnconfirmed(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  public undo(
    tx: IBaseTransaction<T>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  public undoUnconfirmed(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  public abstract objectNormalize(
    tx: IBaseTransaction<T>
  ): IBaseTransaction<T, bigint>;

  // tslint:disable-next-line max-line-length
  public abstract dbSave(
    tx: IBaseTransaction<T> & { senderId: string },
    blockId?: string,
    height?: number
  ): DBOp<M>;

  public afterSave(tx: IBaseTransaction<T>): Promise<void> {
    return Promise.resolve();
  }

  public async ready(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel
  ): Promise<boolean> {
    return this.hookSystem.apply_filters(TxReadyFilter.name, true, tx, sender);
    // if (Array.isArray(sender.multisignatures) && sender.multisignatures.length) {
    //   if (!Array.isArray(tx.signatures)) {
    //     return false;
    //   }
    //   return tx.signatures.length >= sender.multimin;
    // } else {
    //   return true;
    // }
  }

  /**
   * Fetchs Assets From Datastore and returns the same txs with the asset field properly populated.
   * @param {Array<IBaseTransaction<T>>} txs
   * @return {Promise<Array<IBaseTransaction<T>>>}
   */
  public attachAssets(txs: Array<IBaseTransaction<T>>): Promise<void> {
    return Promise.resolve();
  }

  public getMaxBytesSize(): number {
    let size = 0;
    size += 1 + 4 + 32 + 32 + 8 + 8 + 64 + 64; // TransactionLogic.getBytes Buffer base size
    size += 6; // hasRequesterPublicKey, has signSignature, fee;
    return size;
  }
}
