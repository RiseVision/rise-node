import { BlocksModule, BlocksSymbols } from '@risevision/core-blocks';
import {
  IAccountsModel,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { BaseTx } from '@risevision/core-transactions';
import { Address, IBaseTransaction } from '@risevision/core-types';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
import { inject, injectable } from 'inversify';
import * as empty from 'is-empty';
import { Model } from 'sequelize-typescript';
import * as varuint from 'varuint-bitcoin';

@injectable()
export abstract class OldBaseTx<T, M extends Model<any>> extends BaseTx<T, M> {
  @inject(Symbols.modules.system)
  protected systemModule: ISystemModule;
  @inject(BlocksSymbols.modules.blocks)
  protected blocksModule: BlocksModule;

  public async verify(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel
  ): Promise<void> {
    const calcFee = this.calculateMinFee(
      tx,
      sender,
      this.blocksModule.lastBlock.height
    );
    if (tx.fee !== calcFee) {
      throw new Error(
        `Invalid fees for tx[type=${tx.type}]. Expected ${calcFee} - Received ${
          tx.fee
        }`
      );
    }
  }

  public signableBytes(tx: IBaseTransaction<T, bigint>): Buffer {
    const bb = new ByteBuffer(1024, true);

    const recipientV2 =
      !empty(tx.recipientId) && !/^[0-9]+R$/.test(tx.recipientId);

    bb.writeByte(tx.type);
    bb.writeUint32((recipientV2 ? 2 ** 30 : 0) + tx.timestamp);

    bb.append(tx.senderPubData);
    if (recipientV2) {
      const address = this.idsHandler.addressToBytes(tx.recipientId);
      bb.append(varuint.encode(address.length));
      bb.append(address);
    } else if (empty(tx.recipientId)) {
      bb.append(Buffer.alloc(8).fill(0));
    } else {
      bb.append(this.idsHandler.addressToBytes(tx.recipientId));
    }

    bb.append(toBufferLE(tx.amount, this.constants.amountBytes));
    bb.append(this.assetBytes(tx));
    bb.flip();
    return Buffer.from(bb.toBuffer());
  }

  public fromBytes(buff: Buffer): IBaseTransaction<T, bigint> {
    let offset = 0;
    const self = this;
    let recipientVersion = 1;

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

    function readAsset(): T {
      const res = self.readAsset(buff.slice(offset));
      offset += res.consumedBytes;
      return res.asset;
    }

    function readSignatures(): Buffer[] {
      const remBuf = buff.slice(offset);
      return new Array(remBuf.length / 64).fill(null).map(() => readSlice(64));
    }

    function readTimeStamp(): number {
      let timestamp = readUint32();
      if (timestamp >= 2 ** 30) {
        timestamp = timestamp - 2 ** 30;
        recipientVersion = 2;
      } else {
        recipientVersion = 1;
      }

      return timestamp;
    }

    const readRecipient = (): Address => {
      if (recipientVersion === 1) {
        return this.idsHandler.addressFromBytes(readSlice(8));
      } else {
        return this.idsHandler.addressFromBytes(readVarUint());
      }
    };

    return {
      // tslint:disable object-literal-sort-keys
      type: readUint8(),
      timestamp: readTimeStamp(),
      ...(() => {
        const senderPubData = readSlice(32);
        return {
          senderId: this.idsHandler.addressFromPubData(senderPubData),
          senderPubData,
        };
      })(),
      recipientId: readRecipient(),
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
