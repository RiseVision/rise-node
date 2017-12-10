import * as ByteBuffer from 'bytebuffer';
import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import z_schema from 'z-schema';
import { BigNum, constants, Ed, IKeypair } from '../helpers/';
import { IBlockLogic, ITransactionLogic } from '../ioc/interfaces/logic/';
import { Symbols } from '../ioc/symbols';
import logicBlockSchema from '../schema/logic/block';
import { BlockRewardLogic } from './blockReward';
import { IBaseTransaction, IConfirmedTransaction } from './transactions/';

// import * as OldImplementation from './_block.js';

// tslint:disable-next-line interface-over-type-literal
export type BlockType = {
  height?: number;
  version: number;
  totalAmount: number;
  totalFee: number;
  reward: number;
  payloadHash: string;
  timestamp: number;
  numberOfTransactions: number;
  payloadLength: number;
  previousBlock: string;
  generatorPublicKey: string;
  transactions?: Array<IBaseTransaction<any>>;
};

export type SignedBlockType = BlockType & {
  id: string;
  blockSignature: string;
  transactions?: Array<IConfirmedTransaction<any>>;
};

export type SignedAndChainedBlockType = SignedBlockType & {
  height: number
};

@injectable()
export class BlockLogic implements IBlockLogic {
  /**
   * Calculates block id.
   * @param {BlockType} block
   * @returns {string}
   */
  public static getId(block: BlockType): string {
    const hash = crypto.createHash('sha256').update(this.getBytes(block)).digest();
    const temp = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
      temp[i] = hash[7 - i];
    }
    return BigNum.fromBuffer(temp).toString();
  }

  public static getHash(block: BlockType, includeSignature: boolean = true) {
    return crypto.createHash('sha256')
      .update(this.getBytes(block, includeSignature))
      .digest();
  }

  public static getBytes(block: BlockType | SignedBlockType, includeSignature: boolean = true): Buffer {
    const size = 4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 64;
    const bb   = new ByteBuffer(size, true /* little endian */);
    bb.writeInt(block.version);
    bb.writeInt(block.timestamp);

    if (block.previousBlock) {
      const pb = new BigNum(block.previousBlock)
        .toBuffer({size: 8});

      for (let i = 0; i < 8; i++) {
        bb.writeByte(pb[i]);
      }
    } else {
      for (let i = 0; i < 8; i++) {
        bb.writeByte(0);
      }
    }

    bb.writeInt(block.numberOfTransactions);

    // tslint:disable no-string-literal
    bb['writeLong'](block.totalAmount);
    bb['writeLong'](block.totalFee);
    bb['writeLong'](block.reward);
    // tslint:enable no-string-literal

    bb.writeInt(block.payloadLength);

    const payloadHashBuffer = Buffer.from(block.payloadHash, 'hex');
    // tslint:disable-next-line
    for (let i = 0; i < payloadHashBuffer.length; i++) {
      bb.writeByte(payloadHashBuffer[i]);
    }

    const generatorPublicKeyBuffer = Buffer.from(block.generatorPublicKey, 'hex');
    // tslint:disable-next-line
    for (let i = 0; i < generatorPublicKeyBuffer.length; i++) {
      bb.writeByte(generatorPublicKeyBuffer[i]);
    }

    if (typeof((block as SignedBlockType).blockSignature) !== 'undefined' && includeSignature) {
      const blockSignatureBuffer = Buffer.from((block as SignedBlockType).blockSignature, 'hex');
      // tslint:disable-next-line
      for (let i = 0; i < blockSignatureBuffer.length; i++) {
        bb.writeByte(blockSignatureBuffer[i]);
      }
    }

    bb.flip();

    return bb.toBuffer() as any;
  }

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

  @inject(Symbols.logic.blockReward)
  private blockReward: BlockRewardLogic;
  @inject(Symbols.helpers.ed)
  private ed: Ed;
  @inject(Symbols.logic.transaction)
  private transaction: ITransactionLogic;

  /**
   * Use static method instead
   * @deprecated
   */
  public getId(block: BlockType): string {
    return BlockLogic.getId(block);
  }

  /**
   * the schema for logic block
   */
  get schema(): typeof logicBlockSchema {
    return logicBlockSchema;
  }

  public create(data: {
    keypair: IKeypair, timestamp: number,
    transactions: Array<IBaseTransaction<any>>,
    previousBlock?: SignedAndChainedBlockType
  }): SignedBlockType {
    const transactions = data.transactions.sort((a, b) => {
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

    const nextHeight = (data.previousBlock) ? data.previousBlock.height + 1 : 1;

    const reward    = this.blockReward.calcReward(nextHeight);
    let totalFee    = 0;
    let totalAmount = 0;
    let size        = 0;

    const blockTransactions = [];
    const payloadHash       = crypto.createHash('sha256');

    for (const transaction of transactions) {
      const bytes: Buffer = this.transaction.getBytes(transaction);

      if (size + bytes.length > constants.maxPayloadLength) {
        break;
      }

      size += bytes.length;

      totalFee += transaction.fee;
      totalAmount += transaction.amount;

      blockTransactions.push(transaction);
      payloadHash.update(bytes);
    }

    const block: SignedBlockType = {
      blockSignature      : null,
      generatorPublicKey  : data.keypair.publicKey.toString('hex'),
      numberOfTransactions: blockTransactions.length,
      payloadHash         : payloadHash.digest().toString('hex'),
      payloadLength       : size,
      previousBlock       : data.previousBlock.id,
      reward,
      timestamp           : data.timestamp,
      totalAmount,
      totalFee,
      transactions        : blockTransactions,
      version             : 0,
    } as any; // FIXME id is missing so it's not a SignedBlockType

    block.blockSignature = this.sign(block, data.keypair);
    return this.objectNormalize(block);
  }

  /**
   * Sign the block
   * @param {BlockType} block
   * @param {IKeypair} key
   * @returns {string}
   */
  public sign(block: BlockType, key: IKeypair): string {
    return this.ed.sign(
      BlockLogic.getHash(block, false),
      key
    ).toString('hex');
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
    return this.ed.verify(
      BlockLogic.getHash(block, false),
      Buffer.from(block.blockSignature, 'hex'),
      Buffer.from(block.generatorPublicKey, 'hex')
    );
  }

  /**
   * Creates db object transaction to `blocks` table.
   * @param {BlockType} block
   * TODO: Change method name to something more meaningful as this does NOT save
   */
  public dbSave(block: SignedBlockType) {
    const payloadHash        = Buffer.from(block.payloadHash, 'hex');
    const generatorPublicKey = Buffer.from(block.generatorPublicKey, 'hex');
    const blockSignature     = Buffer.from(block.blockSignature, 'hex');

    return {
      fields: this.dbFields,
      table : this.table,
      values: {
        blockSignature,
        generatorPublicKey,
        height              : block.height,
        id                  : block.id,
        numberOfTransactions: block.numberOfTransactions,
        payloadHash,
        payloadLength       : block.payloadLength,
        previousBlock       : block.previousBlock || null,
        reward              : block.reward || 0,
        timestamp           : block.timestamp,
        totalAmount         : block.totalAmount,
        totalFee            : block.totalFee,
        version             : block.version,
      },
    };
  }

  /**
   * Normalize block object and eventually throw if something is not valid
   * Does NOT perform signature validation but just content validation.
   * @param {BlockType} block
   * @returns {BlockType}
   */
  public objectNormalize<T extends BlockType>(block: T): T {
    // Delete null or undefined elements in block obj
    for (const key in block) {
      if (block[key] === null || typeof(block[key]) === 'undefined') {
        delete block[key];
      }
    }

    const report = this.zschema.validate(
      block,
      this.schema
    );
    if (!report) {
      throw new Error(`Failed to validate block schema: ${this.zschema
        .getLastErrors().map((err) => err.message).join(', ')}`
      );
    }

    for (let i = 0; i < block.transactions.length; i++) {
      block.transactions[i] = this.transaction.objectNormalize(block.transactions[i]);
    }

    return block;
  }

  public dbRead(rawBlock: any): SignedBlockType {
    if (!rawBlock.b_id) {
      return null;
    } else {
      const block       = {
        blockSignature      : rawBlock.b_blockSignature,
        confirmations       : parseInt(rawBlock.b_confirmations, 10),
        generatorId         : this.getAddressByPublicKey(rawBlock.b_generatorPublicKey),
        generatorPublicKey  : rawBlock.b_generatorPublicKey,
        height              : parseInt(rawBlock.b_height, 10),
        id                  : rawBlock.b_id,
        numberOfTransactions: parseInt(rawBlock.b_numberOfTransactions, 10),
        payloadHash         : rawBlock.b_payloadHash,
        payloadLength       : parseInt(rawBlock.b_payloadLength, 10),
        previousBlock       : rawBlock.b_previousBlock,
        reward              : parseInt(rawBlock.b_reward, 10),
        timestamp           : parseInt(rawBlock.b_timestamp, 10),
        totalAmount         : parseInt(rawBlock.b_totalAmount, 10),
        totalFee            : parseInt(rawBlock.b_totalFee, 10),
        totalForged         : '',
        version             : parseInt(rawBlock.b_version, 10),
      };
      block.totalForged = new BigNum(block.totalFee).plus(new BigNum(block.reward)).toString();
      return block;
    }
  }

  private getAddressByPublicKey(publicKey: Buffer | string) {
    if (typeof(publicKey) === 'string') {
      publicKey = new Buffer(publicKey, 'hex');
    }
    const publicKeyHash = crypto.createHash('sha256')
      .update(publicKey).digest();
    const temp          = Buffer.alloc(8);

    for (let i = 0; i < 8; i++) {
      temp[i] = publicKeyHash[7 - i];
    }
    return `${BigNum.fromBuffer(temp).toString()}R`;
  }
}
