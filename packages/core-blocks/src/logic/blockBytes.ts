import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import {
  BlockHeader,
  ConstantsType,
  IIdsHandler,
  ITXBytes,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
import { inject, injectable } from 'inversify';
import * as varuint from 'varuint-bitcoin';

@injectable()
export class BlockBytes {
  @inject(Symbols.generic.constants)
  protected constants: ConstantsType;
  @inject(p2pSymbols.helpers.protoBuf)
  protected protoBufHelper: ProtoBufHelper;

  @inject(Symbols.helpers.idsHandler)
  protected idsHandler: IIdsHandler;
  @inject(Symbols.helpers.txBytes)
  protected txBytes: ITXBytes;

  get maxHeaderSize() {
    return (
      4 +
      4 +
      this.idsHandler.maxBlockIdBytesUsage +
      4 +
      this.constants.amountBytes * 3 +
      4 +
      32 +
      32 +
      64
    );
  }

  /**
   * Creates bytes to either verify or sign a transaction
   * @param block
   * @param includeSignature
   */
  public signableBytes(
    block: BlockHeader<Buffer, bigint>,
    includeSignature: boolean
  ): Buffer {
    function encodeVarUint(buf: Buffer) {
      return Buffer.concat([varuint.encode(buf.length), buf]);
    }

    const bb = new ByteBuffer(this.maxHeaderSize, true /* little endian */);

    bb.writeUint32(block.version);
    bb.writeUint32(block.timestamp);

    bb.append(
      encodeVarUint(this.idsHandler.blockIdToBytes(block.previousBlock))
    );

    bb.writeUint32(block.numberOfTransactions);
    bb.append(toBufferLE(block.totalAmount, this.constants.amountBytes));
    bb.append(toBufferLE(block.totalFee, this.constants.amountBytes));
    bb.append(toBufferLE(block.reward, this.constants.amountBytes));

    bb.writeUint32(block.payloadLength);
    bb.append(encodeVarUint(block.payloadHash));
    bb.append(block.generatorPublicKey);

    if (block.blockSignature && includeSignature) {
      bb.append(block.blockSignature);
    }

    bb.flip();
    return Buffer.from(bb.toBuffer());
  }

  public fromSignableBytes<T>(buff: Buffer): BlockHeader<Buffer, bigint> {
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

    const version = readUint32();
    const timestamp = readUint32();

    const previousBlock = this.idsHandler.blockIdFromBytes(readVarUint());

    const numberOfTransactions = readUint32();

    const totalAmount = toBigIntLE(readSlice(this.constants.amountBytes));
    const totalFee = toBigIntLE(readSlice(this.constants.amountBytes));
    const reward = toBigIntLE(readSlice(this.constants.amountBytes));

    const payloadLength = readUint32();
    const payloadHash = readVarUint();

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

  public toBuffer(block: SignedAndChainedBlockType) {
    const header = this.signableBytes(block, true);
    const transactions = block.transactions.map((t) =>
      this.txBytes.toBuffer(t)
    );

    return this.protoBufHelper.encode(
      {
        header,
        height: block.height,
        transactions,
      },
      'blocks.bytes',
      'bytesBlock'
    );
  }

  public fromBuffer(buf: Buffer): SignedAndChainedBlockType {
    const { header, height, transactions } = this.protoBufHelper.decode(
      buf,
      'blocks.bytes',
      'bytesBlock'
    );

    const transformedTxs = (transactions || []).map((t: Buffer) =>
      this.txBytes.fromBuffer(t)
    );

    const blockHeader = this.fromSignableBytes(header);

    return {
      ...blockHeader,
      blockSignature: blockHeader.blockSignature,
      height,
      id: this.idsHandler.calcBlockIdFromBytes(header),
      transactions: transformedTxs,
    };
  }
}
