import { IIdsHandler, Symbols } from '@risevision/core-interfaces';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import { TXBytes, TXSymbols } from '@risevision/core-transactions';
import {
  BlockHeader,
  ConstantsType,
  SignedAndChainedBlockType,
} from '@risevision/core-types';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
import { inject, injectable } from 'inversify';

@injectable()
export class BlockBytes {
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(p2pSymbols.helpers.protoBuf)
  private protoBufHelper: ProtoBufHelper;

  @inject(Symbols.helpers.idsHandler)
  private idsHandler: IIdsHandler;
  @inject(TXSymbols.txBytes)
  private txBytes: TXBytes;

  get headerSize() {
    return (
      4 +
      4 +
      this.idsHandler.blockIdByteSize +
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
    const bb = new ByteBuffer(this.headerSize, true /* little endian */);

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
    return bb.toBuffer() as any;
  }

  public fromSignableBytes<T>(buff: Buffer): BlockHeader<Buffer, bigint> {
    let offset = 0;
    const version = buff.readUInt32LE(0);
    offset += 4;
    const timestamp = buff.readUInt32LE(offset);
    offset += 4;
    const previousBlock = this.idsHandler.blockIdFromBytes(
      buff.slice(offset, offset + this.idsHandler.blockIdByteSize)
    );
    offset += this.idsHandler.blockIdByteSize;
    const numberOfTransactions = buff.readUInt32LE(offset);
    offset += 4;

    const totalAmount = toBigIntLE(
      buff.slice(offset, offset + this.constants.amountBytes)
    );
    offset += this.constants.amountBytes;
    const totalFee = toBigIntLE(
      buff.slice(offset, offset + this.constants.amountBytes)
    );
    offset += this.constants.amountBytes;
    const reward = toBigIntLE(
      buff.slice(offset, offset + this.constants.amountBytes)
    );
    offset += this.constants.amountBytes;

    const payloadLength = buff.readUInt32LE(offset);
    offset += 4;
    const payloadHash = buff.slice(offset, offset + 32);
    offset += 32;
    const generatorPublicKey = buff.slice(offset, offset + 32);
    offset += 32;

    let blockSignature: Buffer = null;
    if (offset !== buff.length) {
      blockSignature = buff.slice(offset, offset + 64);
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
