import {
  IAccountsModel,
  IBaseTransactionType,
  IIdsHandler,
  Symbols,
} from '@risevision/core-interfaces';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import {
  DBOp,
  IBaseTransaction,
  SignedBlockType,
} from '@risevision/core-types';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
import { inject, injectable } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { Model } from 'sequelize-typescript';
import * as varuint from 'varuint-bitcoin';
import { TxConstantsType } from './helpers';
import { TxReadyFilter } from './hooks/filters';
import { TXSymbols } from './txSymbols';

const emptyBuffer = new Buffer(0);

/**
 * Describes a Base Transaction Object
 */
@injectable()
export abstract class BaseTx<T, M extends Model<any>>
  implements IBaseTransactionType<T, M> {
  // Should be set externally
  public type: number;
  @inject(LaunchpadSymbols.hookSystem)
  protected hookSystem: WordPressHookSystem;
  @inject(Symbols.helpers.idsHandler)
  protected idsHandler: IIdsHandler;

  @inject(TXSymbols.constants)
  protected txConstants: TxConstantsType;

  public abstract calculateMinFee(
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

    bb.writeUint32(tx.version);
    bb.writeUint32(tx.timestamp);

    bb.append(encodeVarUint(tx.senderPubData));
    bb.append(encodeVarUint(this.idsHandler.addressToBytes(tx.recipientId)));

    bb.append(toBufferLE(tx.amount, this.txConstants.amountBytes));
    bb.append(toBufferLE(tx.fee, this.txConstants.amountBytes));

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

    return {
      // tslint:disable object-literal-sort-keys
      id: this.idsHandler.calcTxIdFromBytes(buff),
      type: readUint8(),
      version: readUint32(),
      timestamp: readUint32(),
      ...(() => {
        const senderPubData = readVarUint();
        return {
          senderId: this.idsHandler.addressFromPubData(senderPubData),
          senderPubData,
        };
      })(),
      senderPubData: readVarUint(),
      recipientId: this.idsHandler.addressFromBytes(readVarUint()),
      amount: toBigIntLE(readSlice(this.txConstants.amountBytes)),
      fee: toBigIntLE(readSlice(this.txConstants.amountBytes)),
      asset: this.readAssetFromBytes(readVarUint()),
      signatures: (() =>
        new Array(Math.floor(buff.length - offset))
          .fill(null)
          .map(() => readSlice(64)))(),
      // tslint:enable object-literal-sort-keys
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
