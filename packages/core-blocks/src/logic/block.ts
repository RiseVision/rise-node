import {
  IAccountLogic,
  IBlockLogic,
  IBlocksModel,
  ICrypto,
  IIdsHandler,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import { TXBytes, TXSymbols } from '@risevision/core-transactions';
import {
  BlockType,
  ConstantsType,
  DBOp,
  IBaseTransaction,
  IKeypair,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '@risevision/core-types';
import { toBigIntBE } from 'bigint-buffer';
import * as crypto from 'crypto';
import * as filterObject from 'filter-object';
import { inject, injectable, named } from 'inversify';
import { Overwrite } from 'utility-types';
import z_schema from 'z-schema';
import { BlocksConstantsType } from '../blocksConstants';
import { BlocksSymbols } from '../blocksSymbols';
import { BlockBytes } from './blockBytes';
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

  @inject(BlocksSymbols.logic.blockBytes)
  private blockBytes: BlockBytes;
  @inject(TXSymbols.txBytes)
  private txBytes: TXBytes;
  @inject(Symbols.helpers.idsHandler)
  private idsHandler: IIdsHandler;

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

    const nextHeight = data.previousBlock ? data.previousBlock.height + 1 : 1;

    const reward    = this.blockReward.calcReward(nextHeight);
    let totalFee    = 0n;
    let totalAmount = 0n;
    let size        = 0;

    const blockTransactions = [];
    const payloadHash       = crypto.createHash('sha256');

    for (const transaction of transactions) {
      const bytes: Buffer = this.txBytes.fullBytes(transaction);

      if (size + bytes.length > this.constants.blocks.maxPayloadLength) {
        break;
      }

      size += bytes.length;

      totalFee += transaction.fee;
      totalAmount += transaction.amount;

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
    block.id             = this.idsHandler
      .blockIdFromBytes(this.blockBytes.signableBytes(block, true));
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

  public getHash(block: BlockType, includeSignature: boolean = true) {
    return crypto
      .createHash('sha256')
      .update(this.blockBytes.signableBytes(block, includeSignature))
      .digest();
  }

}
