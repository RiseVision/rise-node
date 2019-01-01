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
import * as varuint from 'varuint-bitcoin';
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

  public async findConflicts(
    txs: Array<IBaseTransaction<T>>
  ): Promise<Array<IBaseTransaction<T>>> {
    return [];
  }

  public fullBytes(tx: IBaseTransaction<T>): Buffer {
    return Buffer.concat([this.signableBytes(tx), ...(tx.signatures || [])]);
  }

  public signableBytes(tx: IBaseTransaction<T>): Buffer {
    const bb = new ByteBuffer(1024, true);

    function encodeVarUint(buf: Buffer) {
      return Buffer.concat([varuint.encode(buf.length), buf]);
    }

    bb.writeByte(tx.type);
    if (tx.version) {
      bb.writeUint32(2 ** 32 - 128 + tx.version);
    }
    bb.writeUint32(tx.timestamp);

    bb.append(encodeVarUint(tx.senderPubData));
    bb.append(encodeVarUint(this.idsHandler.addressToBytes(tx.recipientId)));

    bb.append(toBufferLE(tx.amount, this.constants.amountBytes));
    bb.append(toBufferLE(tx.fee, this.constants.amountBytes));

    bb.append(encodeVarUint(this.assetBytes(tx)));
    bb.flip();
    return new Buffer(bb.toBuffer());
  }

  public assetBytes(tx: IBaseTransaction<T>): Buffer {
    return emptyBuffer;
  }

  public readAssetFromBytes(bytes: Buffer): T {
    return null;
  }

  /**
   * Returns asset, given Buffer containing it
   */
  public fromBytes(buff: Buffer): IBaseTransaction<T, bigint> {
    let offset = 0;
    function readVarUint() {
      const length = varuint.decode(buff, offset);
      offset += varuint.decode.bytes;
      return readSlice(length);
    }

    function readUint8() {
      const toRet = buff.readUInt8(offset);
      offset += 1;
      return toRet;
    }
    function readUint32() {
      const toRet = buff.readUInt32LE(offset);
      offset += 4;
      return toRet;
    }
    function readSlice(howMuch: number) {
      const toRet = buff.slice(offset, offset + howMuch);
      offset += howMuch;
      return toRet;
    }

    const type = readUint8();
    let timestamp = readUint32();
    let version = 0;
    if (timestamp >= 2 ** 32 - 128) {
      version = timestamp - 2 ** 32 - 128;
      timestamp = readUint32();
    }

    const senderPubData = readVarUint();
    const recipientId = this.idsHandler.addressFromBytes(readVarUint());

    const amount = toBigIntLE(readSlice(this.constants.amountBytes));

    const fee = toBigIntLE(readSlice(this.constants.amountBytes));

    const asset = this.readAssetFromBytes(readVarUint());

    const nSignatures = Math.floor((buff.length - offset) / 64);
    const signatures = new Array(nSignatures)
      .fill(null)
      .map(() => readSlice(64));

    return {
      amount,
      asset,
      fee,
      id: this.idsHandler.calcTxIdFromBytes(buff),
      recipientId,
      senderId: this.idsHandler.addressFromPubData(senderPubData),
      senderPubData,
      signatures,
      timestamp,
      type,
      version,
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
    size += 1 + 4 + 4 + 32 + 32 + 8 + 8 + 64; // TransactionLogic.getBytes Buffer base size
    size += 6; // hasRequesterPublicKey, has signSignature, fee;
    return size;
  }
}
