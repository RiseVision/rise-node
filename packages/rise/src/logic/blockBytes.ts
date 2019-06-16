import { BlockBytes } from '@risevision/core-blocks';
import { BlockHeader } from '@risevision/core-types';
import * as ByteBuffer from 'bytebuffer';

import { toBigIntLE, toBufferLE } from 'bigint-buffer';

export class RiseBlockBytes extends BlockBytes {
  public signableBytes(
    block: BlockHeader<Buffer, bigint>,
    includeSignature: boolean
  ): Buffer {
    if (block.version === 1) {
      return super.signableBytes(block, includeSignature);
    }
    return this.oldSignableBytes(block, includeSignature);
  }

  public fromSignableBytes<T>(buff: Buffer): BlockHeader<Buffer, bigint> {
    let offset = 0;

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

    const version = readUint32();
    if (version === 1) {
      return super.fromSignableBytes(buff);
    }
    // Otherwise fallback to previous version.
    const timestamp = readUint32();

    const previousBlock =
      timestamp === 0 ? null : this.idsHandler.blockIdFromBytes(readSlice(8));

    const numberOfTransactions = readUint32();

    const totalAmount = toBigIntLE(readSlice(this.constants.amountBytes));
    const totalFee = toBigIntLE(readSlice(this.constants.amountBytes));
    const reward = toBigIntLE(readSlice(this.constants.amountBytes));

    const payloadLength = readUint32();
    const payloadHash = readSlice(32);

    const generatorPublicKey = readSlice(32);

    let blockSignature: Buffer = null;
    if (offset !== buff.length) {
      blockSignature = readSlice(64);
    }

    return {
      blockSignature,
      generatorPublicKey,
      numberOfTransactions,
      payloadHash,
      payloadLength,
      previousBlock,
      reward,
      timestamp,
      totalAmount,
      totalFee,
      version,
    };
  }

  private oldSignableBytes(
    block: BlockHeader<Buffer, bigint>,
    includeSignature: boolean
  ) {
    // Fallback to version 0 which didnt use varuint
    const bb = new ByteBuffer(this.maxHeaderSize, true /* little endian */);

    bb.writeUint32(block.version);
    bb.writeUint32(block.timestamp);

    bb.append(this.idsHandler.blockIdToBytes(block.previousBlock));

    bb.writeUint32(block.numberOfTransactions);
    bb.append(toBufferLE(block.totalAmount, this.constants.amountBytes));
    bb.append(toBufferLE(block.totalFee, this.constants.amountBytes));
    bb.append(toBufferLE(block.reward, this.constants.amountBytes));

    bb.writeUint32(block.payloadLength);
    bb.append(block.payloadHash);
    bb.append(block.generatorPublicKey);

    if (block.blockSignature && includeSignature) {
      bb.append(block.blockSignature);
    }

    bb.flip();
    return Buffer.from(bb.toBuffer());
  }
}
