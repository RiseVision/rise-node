import {
  IAccountLogic,
  IAccountsModel,
  ICrypto,
  IIdsHandler,
  ILogger,
  ITimeToEpoch,
  ITransactionLogic,
  ITransactionsModel,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import {
  ConstantsType,
  DBBulkCreateOp,
  DBOp,
  IBaseTransaction,
  ITransportTransaction,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '@risevision/core-types';
import * as crypto from 'crypto';
import { inject, injectable, named } from 'inversify';
import * as _ from 'lodash';
import { WordPressHookSystem } from 'mangiafuoco';
import { Model } from 'sequelize-typescript';
import z_schema from 'z-schema';
import { BaseTx } from './BaseTx';
import { TxLogicStaticCheck, TxLogicVerify } from './hooks/actions';
import {
  TxApplyFilter,
  TxApplyUnconfirmedFilter,
  TxUndoFilter,
  TxUndoUnconfirmedFilter,
} from './hooks/filters';
import { TXBytes } from './txbytes';
import { TXSymbols } from './txSymbols';

// tslint:disable-next-line no-var-requires
const txSchema = require('../schema/transaction.json');

@injectable()
export class TransactionLogic implements ITransactionLogic {
  @inject(Symbols.generic.constants)
  private constants: ConstantsType & { blocks: { maxTxsPerBlock: number } };

  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  @inject(Symbols.generic.crypto)
  private crypto: ICrypto;

  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(p2pSymbols.helpers.protoBuf)
  private protoBufHelper: ProtoBufHelper;

  @inject(Symbols.helpers.timeToEpoch)
  private timeToEpoch: ITimeToEpoch;

  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  @inject(TXSymbols.txBytes)
  private txBytes: TXBytes;

  @inject(Symbols.helpers.idsHandler)
  private idsHandler: IIdsHandler;

  @inject(ModelSymbols.model)
  @named(TXSymbols.model)
  private TransactionsModel: typeof ITransactionsModel;
  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;

  private types: { [k: number]: BaseTx<any, any> } = {};

  public attachAssetType<K, M extends Model<any>>(
    instance: BaseTx<K, M>
  ): BaseTx<K, M> {
    if (!(instance instanceof BaseTx)) {
      throw new Error('Invalid instance interface');
    }
    this.types[instance.type] = instance;
    return instance;
  }

  /**
   * Hash for the transaction
   */
  public getHash(tx: IBaseTransaction<any, bigint>): Buffer {
    return crypto
      .createHash('sha256')
      .update(this.types[tx.type].signableBytes(tx))
      .digest();
  }

  public async ready(
    tx: IBaseTransaction<any>,
    sender: IAccountsModel
  ): Promise<boolean> {
    this.assertKnownTransactionType(tx.type);

    if (!sender) {
      return false;
    }

    return this.types[tx.type].ready(tx, sender);
  }

  public assertKnownTransactionType(type: number) {
    if (!(type in this.types)) {
      throw new Error(`Unknown transaction type ${type}`);
    }
  }

  /**
   * Checks if balanceKey is less than amount for sender
   */
  public assertEnoughBalance(
    amount: bigint,
    balanceKey: 'balance' | 'u_balance',
    tx: IBaseTransaction<any>,
    sender: IAccountsModel
  ) {
    const exceededBalance = sender[balanceKey] < amount;
    // tslint:disable-next-line
    if (tx['blockId'] !== this.genesisBlock.id && exceededBalance) {
      throw new Error(
        `\`Account does not have enough currency: ${sender.address} balance: ${
          sender[balanceKey]
        } - ${amount}\``
      );
    }
  }

  public async verify(
    tx: IBaseTransaction<any, bigint>,
    sender: IAccountsModel,
    height: number
  ) {
    this.assertKnownTransactionType(tx.type);
    if (!sender) {
      throw new Error('Missing sender');
    }

    await this.hookSystem.do_action(
      TxLogicStaticCheck.name,
      tx,
      sender,
      height
    );

    if (this.timeToEpoch.getTime() < tx.timestamp) {
      throw new Error(
        'Invalid transaction timestamp. Timestamp is in the future'
      );
    }

    const txID = this.idsHandler.calcTxIdFromBytes(
      this.types[tx.type].fullBytes(tx)
    );
    if (txID !== tx.id) {
      throw new Error(
        `Invalid transaction id - Expected ${txID}, Received ${tx.id}`
      );
    }

    // Check sender public key
    if (sender.publicKey && !sender.publicKey.equals(tx.senderPublicKey)) {
      // tslint:disable-next-line
      throw new Error(
        `Invalid sender public key: ${tx.senderPublicKey.toString(
          'hex'
        )} expected ${sender.publicKey.toString('hex')}`
      );
    }

    // Check sender is not genesis account unless block id equals genesis
    if (
      this.genesisBlock.generatorPublicKey.equals(sender.publicKey) &&
      (tx as IBaseTransaction<any>).blockId !== this.genesisBlock.id
    ) {
      throw new Error('Invalid sender. Can not send from genesis account');
    }

    if (tx.senderId !== sender.address) {
      throw new Error('Invalid sender address');
    }

    if (!this.verifySignature(tx, tx.senderPublicKey, tx.signature)) {
      throw new Error('Failed to verify signature');
    }

    // Check fee
    const fee = this.types[tx.type].calculateFee(tx, sender, height);
    if (fee !== tx.fee) {
      throw new Error('Invalid transaction fee');
    }

    this.assertValidAmounts(tx);

    // Check confirmed sender balance
    this.assertEnoughBalance(tx.amount + tx.fee, 'balance', tx, sender);

    await this.hookSystem.do_action(TxLogicVerify.name, tx, sender, height);
    // // Check timestamp
    // if (this.slots.getSlotNumber(tx.timestamp) > this.slots.getSlotNumber()) {
    //   throw new Error('Invalid transaction timestamp. Timestamp is in the future');
    // }

    await this.types[tx.type].verify(tx, sender);
  }

  /**
   * Verifies the given signature (both first and second)
   * @param {IBaseTransaction<any>} tx
   * @param {Buffer} publicKey
   * @param {string} signature
   * @param {VerificationType} verificationType
   * @returns {boolean} true
   */
  public verifySignature(
    tx: IBaseTransaction<any, bigint>,
    publicKey: Buffer,
    signature: Buffer
  ): boolean {
    this.assertKnownTransactionType(tx.type);
    if (!signature) {
      return false;
    }
    const hash = this.getHash(tx);
    return this.crypto.verify(hash, signature, publicKey);
  }

  public async apply(
    tx: IBaseTransaction<any>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    if (!(await this.ready(tx, sender))) {
      throw new Error('Transaction is not ready');
    }

    const amount = tx.amount + tx.fee;
    this.assertEnoughBalance(tx.amount + tx.fee, 'balance', tx, sender);

    sender.balance -= amount;
    this.logger.trace('Logic/Transaction->apply', {
      balance: -amount,
      blockId: block.id,
      // round  : this.roundsLogic.calcRound(block.height),
      sender: sender.address,
    });
    const ops = this.accountLogic.merge(sender.address, {
      balance: -amount,
      blockId: block.id,
      // round  : this.roundsLogic.calcRound(block.height),
    });
    ops.push(...(await this.types[tx.type].apply(tx, block, sender)));
    return await this.hookSystem.apply_filters(
      TxApplyFilter.name,
      ops,
      tx,
      block,
      sender
    );
  }

  /**
   * Merges account into sender address and calls undo to txtype
   * @returns {Promise<void>}
   */
  public async undo(
    tx: IBaseTransaction<any>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    const amount = BigInt(tx.amount) + BigInt(tx.fee);

    sender.balance += amount;
    this.logger.trace('Logic/Transaction->undo', {
      balance: amount,
      blockId: block.id,
      // round  : this.roundsLogic.calcRound(block.height),
      sender: sender.address,
    });
    const ops = this.accountLogic.merge(sender.address, {
      balance: amount,
      blockId: block.id,
      // round  : this.roundsLogic.calcRound(block.height),
    });
    ops.push(...(await this.types[tx.type].undo(tx, block, sender)));
    return await this.hookSystem.apply_filters(
      TxUndoFilter.name,
      ops,
      tx,
      block,
      sender
    );
  }

  // tslint:disable-next-line max-line-length
  public async applyUnconfirmed(
    tx: IBaseTransaction<any>,
    sender: IAccountsModel,
    requester?: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    const amount = tx.amount + tx.fee;
    this.assertEnoughBalance(amount, 'u_balance', tx, sender);

    sender.u_balance -= amount;

    const ops = this.accountLogic.merge(sender.address, {
      u_balance: -amount,
    });
    ops.push(...(await this.types[tx.type].applyUnconfirmed(tx, sender)));
    return await this.hookSystem.apply_filters(
      TxApplyUnconfirmedFilter.name,
      ops,
      tx,
      sender
    );
  }

  /**
   * Merges account into sender address with unconfirmed balance tx amount
   * Then calls undoUnconfirmed to the txType.
   */
  public async undoUnconfirmed(
    tx: IBaseTransaction<any>,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    const amount = BigInt(tx.amount) + BigInt(tx.fee);

    sender.u_balance += amount;

    const ops = this.accountLogic.merge(sender.address, { u_balance: amount });
    ops.push(...(await this.types[tx.type].undoUnconfirmed(tx, sender)));
    return await this.hookSystem.apply_filters(
      TxUndoUnconfirmedFilter.name,
      ops,
      tx,
      sender
    );
  }

  public dbSave(
    txs: Array<IBaseTransaction<any> & { senderId: string }>,
    blockId: string,
    height: number
  ): Array<DBOp<any>> {
    if (txs.length === 0) {
      return [];
    }
    const bulkCreate: DBBulkCreateOp<ITransactionsModel> = {
      model: this.TransactionsModel,
      type: 'bulkCreate',
      values: txs.map((tx) => {
        this.assertKnownTransactionType(tx.type);
        const senderPublicKey = tx.senderPublicKey;
        const signature = tx.signature;
        // const signSignature   = tx.signSignature ? tx.signSignature : null;
        return {
          // tslint:disable object-literal-sort-keys
          id: tx.id,
          blockId,
          height,
          type: tx.type,
          timestamp: tx.timestamp,
          senderPublicKey,
          senderId: tx.senderId,
          recipientId: tx.recipientId || null,
          amount: BigInt(tx.amount),
          fee: BigInt(tx.fee),
          version: tx.version || 0,
          signature,
          // signSignature,
          signatures: tx.signatures
            ? (tx.signatures
                .map((s: Buffer) => s.toString('hex'))
                .join(',') as any) // Signatures are stringified and joined.
            : null,
          // tslint:enable object-literal-sort-keys
        };
      }),
    };
    const subOps: Array<DBOp<any>> = txs
      .map((tx) => this.types[tx.type].dbSave(tx, blockId, height))
      .filter((op) => op);

    return [bulkCreate, ...subOps];
  }

  public async afterSave(tx: IBaseTransaction<any>): Promise<void> {
    this.assertKnownTransactionType(tx.type);
    return this.types[tx.type].afterSave(tx);
  }

  /**
   * Epurates the tx object by removing null and undefined fields
   * Pass it through schema validation and then calls subtype objectNormalize.
   */
  public objectNormalize(
    tx2:
      | IBaseTransaction<any, string | number | bigint>
      | ITransportTransaction<any>
  ): IBaseTransaction<any, bigint> {
    const tx = _.merge({}, tx2);
    this.assertKnownTransactionType(tx.type);
    for (const key in tx) {
      if (tx[key] === null || typeof tx[key] === 'undefined') {
        delete tx[key];
      }
    }
    // Convert hex encoded fields to Buffers (if they're not already buffers)
    [
      'senderPublicKey',
      'requesterPublicKey',
      'signature',
      'signSignature',
    ].forEach((k) => {
      if (typeof tx[k] === 'string') {
        tx[k] = Buffer.from(tx[k], 'hex');
      }
    });

    tx.amount = BigInt(tx.amount);
    tx.fee = BigInt(tx.fee);
    this.assertValidAmounts(tx as IBaseTransaction<any, bigint>);

    const report = this.schema.validate(tx, txSchema);
    if (!report) {
      throw new Error(
        `Failed to validate transaction schema: ${this.schema
          .getLastErrors()
          .map((e) => e.message)
          .join(', ')}`
      );
    }

    // After processing the tx object becomes a IBaseTransaction<any>
    return this.types[tx.type].objectNormalize(tx as IBaseTransaction<
      any,
      bigint
    >);
  }

  public async attachAssets(txs: Array<IBaseTransaction<any>>): Promise<void> {
    if (txs === null) {
      return;
    }
    const txsByGroup = _.groupBy(txs, (i) => i.type);
    // tslint:disable-next-line forin
    for (const type in txsByGroup) {
      const loopTXs = txsByGroup[type];
      this.assertKnownTransactionType(loopTXs[0].type);
      await this.types[loopTXs[0].type].attachAssets(loopTXs);
    }
  }

  public getMaxBytesSize(): number {
    let max = 0;
    Object.keys(this.types).forEach((type) => {
      max = Math.max(max, this.types[type].getMaxBytesSize());
    });
    return max;
  }

  private assertValidAmounts(tx: IBaseTransaction<any, bigint>) {
    // Check amount
    const amountFields = ['fee', 'amount'];
    amountFields.forEach((k) => {
      const v: bigint = tx[k];
      if (typeof v !== 'bigint') {
        throw new Error(`${k} is not a bigint`);
      }
      if (v < 0 || v > BigInt(this.constants.totalAmount)) {
        throw new Error(
          `tx.${k} is either negative or greater than totalAmount`
        );
      }
    });
  }
}
