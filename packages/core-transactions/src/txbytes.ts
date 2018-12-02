import {
  IBaseTransactionType,
  IIdsHandler,
  Symbols,
} from '@risevision/core-interfaces';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import { ConstantsType, IBaseTransaction } from '@risevision/core-types';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
import { inject, injectable, multiInject } from 'inversify';
import { Model } from 'sequelize-typescript';
import { BaseTx } from './BaseTx';
import { TXSymbols } from './txSymbols';

/**
 * Defines a codec to serialize and deserialize tx fields added by a module.
 */
// tslint:disable-next-line
interface P2PTxCodec<K = {}> {
  // Creates buffer of such field(s)
  toBuffer(tx: IBaseTransaction<any, bigint> & K): Buffer;
  // Reads buffer and modifies tx object adding/modifying it with the read data
  applyFromBuffer<T = any>(
    buffer: Buffer,
    tx: IBaseTransaction<T, bigint>
  ): IBaseTransaction<T, bigint> & K;
}

@injectable()
export class TXBytes {
  private types: { [k: number]: BaseTx<any, any> } = {};

  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(p2pSymbols.helpers.protoBuf)
  private protoBufHelper: ProtoBufHelper;

  @multiInject(TXSymbols.p2p.codecs)
  private p2ptxcodecs: Array<P2PTxCodec<any>>;

  @inject(Symbols.helpers.idsHandler)
  private idsHandler: IIdsHandler;

  public attachAssetType<K, M extends Model<any>>(
    instance: IBaseTransactionType<K, M>
  ): IBaseTransactionType<K, M> {
    if (!(instance instanceof BaseTx)) {
      throw new Error('Invalid instance interface');
    }
    this.types[instance.type] = instance;
    return instance;
  }
  /**
   * Creates bytes to either verify or sign a transaction
   * @param tx
   * @param includeSignature
   */
  public signableBytes(
    tx: IBaseTransaction<any, bigint>,
    includeSignature: boolean
  ): Buffer {
    const bb = new ByteBuffer(1024, true);

    bb.writeByte(tx.type);
    bb.writeInt(tx.timestamp);
    bb.append(tx.senderPublicKey);
    bb.append(this.idsHandler.addressToBytes(tx.recipientId));
    bb.append(toBufferLE(tx.fee, this.constants.amountBytes));
    bb.append(toBufferLE(tx.amount, this.constants.amountBytes));
    bb.append(this.types[tx.type].getBytes(tx));
    if (includeSignature) {
      bb.append(tx.signature);
    }
    bb.flip();
    return bb.toBuffer() as any;
  }

  public fromSignableBytes<T>(buff: Buffer): IBaseTransaction<T, bigint> {
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

    const childBytes = buff.length - offset - 64;
    const assetBytes = buff.slice(offset, offset + childBytes);
    offset += childBytes;

    const signature = buff.slice(offset, offset + 64);

    const id = this.idsHandler.txIdFromBytes(buff);

    const toRet: IBaseTransaction<T, bigint> = {
      amount,
      asset: null,
      fee,
      id,
      recipientId,
      senderId: this.idsHandler.addressFromPubKey(senderPublicKey),
      senderPublicKey,
      signature,
      timestamp,
      type,
    };

    toRet.asset = this.types[toRet.type].fromBytes(assetBytes, toRet);
    return toRet;
  }

  public toBuffer(tx: IBaseTransaction<any, bigint>) {
    const buffers: Buffer[] = [this.signableBytes(tx, true)].concat(
      this.p2ptxcodecs.map((codec) => codec.toBuffer(tx))
    );

    return this.protoBufHelper.encode(
      { buffers },
      'transactions.transport',
      'transportTx'
    );
  }

  public fromBuffer(buf: Buffer) {
    const { buffers } = this.protoBufHelper.decode(
      buf,
      'transactions.transport',
      'transportTx'
    );
    const txObj = this.fromSignableBytes(buffers[0]);
    for (let i = 1; i < buffers.length; i++) {
      this.p2ptxcodecs[i - 1].applyFromBuffer(buffers[i], txObj);
    }
    return txObj;
  }
}
