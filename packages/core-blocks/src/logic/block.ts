import {
  IAccountLogic,
  IBlockLogic,
  IBlocksModel,
  ICrypto,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import {
  BlockType, ConstantsType,
  DBOp,
  IBaseTransaction,
  IBytesBlock,
  IKeypair,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '@risevision/core-types';
import { MyBigNumb } from '@risevision/core-utils';
import { toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
import * as crypto from 'crypto';
import * as filterObject from 'filter-object';
import { inject, injectable, named } from 'inversify';
import { Overwrite } from 'utility-types';
import z_schema from 'z-schema';
import { BlocksConstantsType } from '../blocksConstants';
import { BlocksSymbols } from '../blocksSymbols';
import { BlockRewardLogic } from './blockReward';

// tslint:disable-next-line no-var-requires
const blockSchema = require('../../schema/block.json');

@injectable()
export class BlockLogic implements IBlockLogic {
  public table    = 'blocks';
  public dbFields = [
    'id',
    'version',
    'timestamp',
    'height',
    'previousBlock',
    'numberOfTransactions',
    'totalAmount',
    'totalFee',
    'reward',
    'payloadLength',
    'payloadHash',
    'generatorPublicKey',
    'blockSignature',
  ];
  @inject(Symbols.generic.zschema)
  public zschema: z_schema;

  @inject(Symbols.generic.constants)
  private constants: ConstantsType & BlocksConstantsType;

  @inject(p2pSymbols.helpers.protoBuf)
  private protobufHelper: ProtoBufHelper;

  @inject(Symbols.logic.blockReward)
  private blockReward: BlockRewardLogic;
  @inject(Symbols.generic.crypto)
  private crypto: ICrypto;
  @inject(Symbols.logic.transaction)
  private transaction: ITransactionLogic;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  @inject(ModelSymbols.model)
  @named(BlocksSymbols.model)
  private BlocksModel: typeof IBlocksModel;

  public create(data: {
    keypair: IKeypair;
    timestamp: number;
    transactions: Array<IBaseTransaction<any, bigint>>;
    previousBlock?: SignedAndChainedBlockType;
  }): SignedAndChainedBlockType {
    const transactions = data.transactions;
    transactions.sort((a, b) => {
      if (a.type < b.type) {
        return -1;
      }
      if (a.type > b.type) {
        return 1;
      }
      if (a.amount < b.amount) {
        return -1;
      }
      if (a.amount > b.amount) {
        return 1;
      }
      return 0;
    });

    const nextHeight = data.previousBlock ? data.previousBlock.height + 1 : 1;

    const reward    = this.blockReward.calcReward(nextHeight);
    let totalFee    = 0n;
    let totalAmount = 0n;
    let size        = 0;

    const blockTransactions = [];
    const payloadHash       = crypto.createHash('sha256');

    for (const transaction of transactions) {
      const bytes: Buffer = this.transaction.getBytes(transaction);

      if (size + bytes.length > this.constants.blocks.maxPayloadLength) {
        break;
      }

      size += bytes.length;

      totalFee += BigInt(transaction.fee);
      totalAmount += BigInt(transaction.amount);

      blockTransactions.push(transaction);
      payloadHash.update(bytes);
    }

    const block: SignedAndChainedBlockType = {
      blockSignature      : undefined,
      generatorPublicKey  : data.keypair.publicKey,
      height              : data.previousBlock.height + 1,
      id                  : undefined,
      numberOfTransactions: blockTransactions.length,
      payloadHash         : payloadHash.digest(),
      payloadLength       : size,
      previousBlock       : data.previousBlock.id,
      reward,
      timestamp           : data.timestamp,
      totalAmount,
      totalFee,
      transactions        : blockTransactions,
      version             : 0,
    };

    block.blockSignature = this.sign(block, data.keypair);
    block.id             = this.getId(block);
    return this.objectNormalize(block);
  }

  /**
   * Sign the block
   * @param {BlockType} block
   * @param {IKeypair} key
   * @returns {string}
   */
  public sign(block: BlockType, key: IKeypair): Buffer {
    return this.crypto.sign(this.getHash(block, false), key);
  }

  /**
   * Verifies block hash, generator block public key and block signature
   * @param {BlockType} block
   */
  public verifySignature(block: SignedBlockType): boolean {
    // console.log(block);
    // const res = new OldImplementation(this.ed, this.zschema, this.transaction, null)
    //  .verifySignature(block);
    // console.log(res);
    return this.crypto.verify(
      this.getHash(block, false),
      block.blockSignature,
      block.generatorPublicKey
    );
  }

  /**
   * Creates db object transaction to `blocks` table.
   * @param {BlockType} block
   */
  public dbSaveOp(block: SignedBlockType): DBOp<IBlocksModel & { id: string }> {
    const values = { ...filterObject(block, this.dbFields) };
    return {
      model: this.BlocksModel,
      type : 'create',
      values,
    };
  }

  /**
   * Normalize block object and eventually throw if something is not valid
   * Does NOT perform signature validation but just content validation.
   * Typescript here is a bit obscure but it will basically change numbers to bigint and signature to string
   * @param {BlockType} block
   * @returns {BlockType}
   */
  // TODO: Change this to a pure function!!!
  public objectNormalize<T extends BlockType<string | Buffer, string | bigint>>(
    block: T
  ): Overwrite<T,
    {
      totalAmount: bigint;
      reward: bigint;
      payloadHash: Buffer;
      blockSignature: Buffer;
      generatorPublicKey: Buffer;
    }> {
    // Delete null or undefined elements in block obj
    for (const key in block) {
      if (block[key] === null || typeof block[key] === 'undefined') {
        delete block[key];
      }
    }

    ['generatorPublicKey', 'payloadHash', 'blockSignature'].forEach(
      (bufKey) => {
        if (!Buffer.isBuffer(block[bufKey])) {
          block[bufKey] = Buffer.from(block[bufKey], 'hex');
        }
      }
    );

    const report = this.zschema.validate(block, blockSchema);
    if (!report) {
      throw new Error(
        `Failed to validate block schema: ${this.zschema
          .getLastErrors()
          .map((err) => err.message)
          .join(', ')}`
      );
    }

    (block as any).reward      = BigInt(block.reward);
    (block as any).totalFee    = BigInt(block.totalFee);
    (block as any).totalAmount = BigInt(block.totalAmount);

    if (block.reward as bigint < 0n || block.totalFee as bigint < 0n || block.totalAmount as bigint < 0n) {
      throw new Error('Block validation failed. One of reward,totalFee,totalAmount is lt 0');
    }

    for (let i = 0; i < block.transactions.length; i++) {
      block.transactions[i] = this.transaction.objectNormalize(
        block.transactions[i]
      );
    }

    // cast to any is correct as we transform non-buffer items to
    return block as any;
  }

  /**
   * Calculates block id.
   * @param {BlockType} block
   * @returns {string}
   */
  public getId(block: BlockType): string {
    return this.getIdFromBytes(this.getBytes(block));
  }

  public getHash(block: BlockType, includeSignature: boolean = true) {
    return crypto
      .createHash('sha256')
      .update(this.getBytes(block, includeSignature))
      .digest();
  }

  public getBytes(
    block: BlockType,
    includeSignature: boolean = true
  ): Buffer {
    const size = 4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 64;
    const bb   = new ByteBuffer(size, true /* little endian */);
    bb.writeInt(block.version);
    bb.writeInt(block.timestamp);

    if (block.previousBlock) {
      const pb = new MyBigNumb(block.previousBlock).toBuffer({ size: 8 });

      for (let i = 0; i < 8; i++) {
        bb.writeByte(pb[i]);
      }
    } else {
      for (let i = 0; i < 8; i++) {
        bb.writeByte(0);
      }
    }

    bb.writeInt(block.numberOfTransactions);

    bb.append(toBufferLE(block.totalAmount, this.constants.amountBytes));
    bb.append(toBufferLE(block.totalFee, this.constants.amountBytes));
    bb.append(toBufferLE(block.reward, this.constants.amountBytes));

    bb.writeInt(block.payloadLength);

    const payloadHashBuffer = block.payloadHash;
    // tslint:disable-next-line
    for (let i = 0; i < payloadHashBuffer.length; i++) {
      bb.writeByte(payloadHashBuffer[i]);
    }

    const generatorPublicKeyBuffer = block.generatorPublicKey;
    // tslint:disable-next-line
    for (let i = 0; i < generatorPublicKeyBuffer.length; i++) {
      bb.writeByte(generatorPublicKeyBuffer[i]);
    }

    if (
      typeof (block as SignedBlockType).blockSignature !== 'undefined' &&
      includeSignature
    ) {
      const blockSignatureBuffer = (block as SignedBlockType).blockSignature;
      // tslint:disable-next-line
      for (let i = 0; i < blockSignatureBuffer.length; i++) {
        bb.writeByte(blockSignatureBuffer[i]);
      }
    }

    bb.flip();

    return bb.toBuffer() as any;
  }

  public toProtoBuffer(
    block: SignedAndChainedBlockType & { relays?: number }
  ): Buffer {
    const blk = {
      bytes       : this.getBytes(block),
      height      : block.height,
      relays      : Number.isInteger(block.relays) ? block.relays : 1,
      transactions: (block.transactions || []).map((tx) =>
        this.transaction.toProtoBuffer(tx)
      ),
    };
    return this.protobufHelper.encode(blk, 'blocks.bytes', 'bytesBlock');
  }

  /**
   * Restores a block from its bytes
   */
  public fromProtoBuffer(
    buffer: Buffer
  ): SignedAndChainedBlockType & { relays: number } {
    if (buffer === null || typeof buffer === 'undefined') {
      return null;
    }
    const blk: IBytesBlock = this.protobufHelper.decode(
      buffer,
      'blocks.bytes',
      'bytesBlock'
    );
    const bb               = ByteBuffer.wrap(blk.bytes, 'binary', true);
    const version          = bb.readInt(0);
    const timestamp        = bb.readInt(4);

    // PreviousBlock is valid only if it's not 8 bytes with 0 value
    const previousIdBytes = blk.bytes.slice(8, 16);
    let previousValid     = false;
    for (let i = 0; i < 8; i++) {
      if (previousIdBytes.readUInt8(i) !== 0) {
        previousValid = true;
        break;
      }
    }
    const previousBlock = previousValid
      ? MyBigNumb.fromBuffer(previousIdBytes).toString()
      : null;

    const numberOfTransactions = bb.readInt(16);
    let offset                 = 20;
    const step                   = this.constants.amountBytes;
    const totalAmount          = toBigIntLE(blk.bytes.slice(offset, offset + step));
    offset += step;
    const totalFee             = toBigIntLE(blk.bytes.slice(offset, offset + step));
    offset += step;
    const reward               = toBigIntLE(blk.bytes.slice(offset, offset + step));
    offset += step;
    const payloadLength        = bb.readInt(offset);
    offset += 4;
    const payloadHash          = blk.bytes.slice(offset, offset + 32);
    offset += 32;
    const generatorPublicKey   = blk.bytes.slice(offset, offset + 32);
    offset += 32;
    const blockSignature       =
            blk.bytes.length === offset + 64 ? blk.bytes.slice(offset, offset + 64) : null;
    const id                   = this.getIdFromBytes(blk.bytes);
    const transactions         = blk.transactions.map((tx) => {
      const baseTx = this.transaction.fromProtoBuffer(tx);
      return {
        ...baseTx,
        blockId : id,
        height  : blk.height,
        senderId: this.accountLogic.generateAddressByPublicKey(
          baseTx.senderPublicKey
        ),
      };
    });

    // tslint:disable object-literal-sort-keys
    return {
      id,
      version,
      timestamp,
      previousBlock,
      numberOfTransactions,
      totalAmount,
      totalFee,
      reward,
      payloadLength,
      payloadHash,
      generatorPublicKey,
      blockSignature,
      transactions,
      height: blk.height,
      relays: blk.relays,
    };
  }

  public getMinBytesSize(): number {
    let size = 4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 64; // Block's bytes
    size += 4; // height
    return size;
  }

  public getMaxBytesSize(): number {
    let size        = this.getMinBytesSize();
    const maxTxSize = this.transaction.getMaxBytesSize();
    size += this.constants.blocks.maxTxsPerBlock * maxTxSize; // transactions
    return size;
  }

  private getIdFromBytes(bytes: Buffer): string {
    const hash = crypto
      .createHash('sha256')
      .update(bytes)
      .digest();
    const temp = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
      temp[i] = hash[7 - i];
    }
    return MyBigNumb.fromBuffer(temp).toString();
  }
}
