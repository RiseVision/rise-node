import {
  IAccountsModel,
  IBaseTransactionType,
  IIdsHandler,
  Symbols,
} from '@risevision/core-interfaces';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import {
  ConstantsType,
  DBOp,
  IBaseTransaction,
  SignedBlockType,
  TransactionType,
} from '@risevision/core-types';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
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
  @inject(Symbols.helpers.idsHandler)
  private idsHandler: IIdsHandler;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
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

  public fullBytes(tx: IBaseTransaction<T>): Buffer {
    return Buffer.concat([
      this.signableBytes(tx),
      tx.signature,
      ...(tx.signatures || []),
    ]);
  }

  public signableBytes(tx: IBaseTransaction<T>): Buffer {
    const bb = new ByteBuffer(1024, true);

    bb.writeByte(tx.type);
    bb.writeInt(tx.timestamp);
    bb.append(tx.senderPublicKey);
    bb.append(this.idsHandler.addressToBytes(tx.recipientId));
    bb.append(toBufferLE(tx.fee, this.constants.amountBytes));
    bb.append(toBufferLE(tx.amount, this.constants.amountBytes));
    bb.append(this.assetBytes(tx));
    bb.flip();
    return new Buffer(bb.toBuffer());
  }

  public assetBytes(tx: IBaseTransaction<T>): Buffer {
    return emptyBuffer;
  }

  public readAssetFromBytes(
    bytes: Buffer
  ): { asset: T; consumedBytes: number } {
    return { asset: null, consumedBytes: 0 };
  }

  /**
   * Returns asset, given Buffer containing it
   */
  public fromBytes(buff: Buffer): IBaseTransaction<T, bigint> {
    let offset = 0;
    const type = buff.readUInt8(0);
    offset += 1;
    const timestamp = buff.readUInt32LE(offset);
    offset += 4;
    const senderPublicKey = buff.slice(offset, offset + 32);
    offset += 32;
    const recipientId = this.idsHandler.addressFromBytes(
      buff.slice(offset, offset + this.idsHandler.addressBytes)
    );
    offset += this.idsHandler.addressBytes;

    const fee = toBigIntLE(
      buff.slice(offset, offset + this.constants.amountBytes)
    );
    offset += this.constants.amountBytes;
    const amount = toBigIntLE(
      buff.slice(offset, offset + this.constants.amountBytes)
    );
    offset += this.constants.amountBytes;

    const { asset, consumedBytes } = this.readAssetFromBytes(
      buff.slice(offset)
    );
    offset += consumedBytes;

    const signature = buff.slice(offset, offset + 64);
    offset += 64;

    const nSignatures = Math.floor((buff.length - offset) / 64);
    const signatures = new Array(nSignatures)
      .fill(null)
      .map((a, idx) => buff.slice(idx * 64 + offset, idx * 64 + offset + 64));

    return {
      amount,
      asset,
      fee,
      id: this.idsHandler.txIdFromBytes(buff),
      recipientId,
      senderId: this.idsHandler.addressFromPubKey(senderPublicKey),
      senderPublicKey,
      signature,
      signatures,
      timestamp,
      type,
    };
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
    size += 1 + 4 + 32 + 32 + 8 + 8 + 64; // TransactionLogic.getBytes Buffer base size
    size += 6; // hasRequesterPublicKey, has signSignature, fee;
    return size;
  }
}
