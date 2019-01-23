import { ISystemModule, Symbols } from '@risevision/core-interfaces';
import { BaseTx } from '@risevision/core-transactions';
import { IBaseTransaction } from '@risevision/core-types';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
import { inject, injectable } from 'inversify';
import { Model } from 'sequelize-typescript';

@injectable()
export abstract class OldBaseTx<T, M extends Model<any>> extends BaseTx<T, M> {
  @inject(Symbols.modules.system)
  protected systemModule: ISystemModule;

  public signableBytes(tx: IBaseTransaction<T, bigint>): Buffer {
    const bb = new ByteBuffer(1024, true);

    bb.writeByte(tx.type);
    bb.writeUint32(tx.timestamp);
    bb.append(tx.senderPubData);
    bb.append(this.idsHandler.addressToBytes(tx.recipientId));
    bb.append(toBufferLE(tx.amount, this.constants.amountBytes));
    bb.append(this.assetBytes(tx));
    bb.flip();
    return Buffer.from(bb.toBuffer());
  }

  public fromBytes(buff: Buffer): IBaseTransaction<T, bigint> {
    let offset = 0;
    const self = this;

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

    function readAsset(): T {
      const res = self.readAsset(buff.slice(offset));
      offset += res.consumedBytes;
      return res.asset;
    }

    function readSignatures(): Buffer[] {
      const remBuf = buff.slice(offset);
      return new Array(remBuf.length / 64).fill(null).map(() => readSlice(64));
    }

    return {
      // tslint:disable object-literal-sort-keys
      type: readUint8(),
      timestamp: readUint32(),
      senderPubData: readSlice(32),
      recipientId: this.idsHandler.addressFromBytes(readSlice(8)),
      amount: toBigIntLE(readSlice(this.constants.amountBytes)),
      asset: readAsset(),
      signatures: readSignatures(),
      fee: this.calculateMinFee(null, null, this.systemModule.getHeight()),
      version: 0,
      id: this.idsHandler.calcTxIdFromBytes(buff),
    };
  }

  // Defaults
  public objectNormalize(
    tx: IBaseTransaction<T, bigint>
  ): IBaseTransaction<T, bigint> {
    return tx;
  }

  // Defaults
  protected readAsset(
    remainingBuff: Buffer
  ): { consumedBytes: number; asset: T } {
    return { consumedBytes: 0, asset: null };
  }
}
