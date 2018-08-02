import { BigNumber } from 'bignumber.js';
import * as ByteBuffer from 'bytebuffer';
import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { Model } from 'sequelize-typescript';
import z_schema from 'z-schema';
import {
  BigNum,
  constants,
  Ed,
  ExceptionsList,
  ExceptionsManager,
  IKeypair,
  ILogger,
  Slots
} from '../helpers/';
import { RunThroughExceptions } from '../helpers/decorators/exceptions';
import { IAccountLogic, IRoundsLogic, ITransactionLogic, VerificationType } from '../ioc/interfaces/logic/';
import { Symbols } from '../ioc/symbols';
import { AccountsModel, TransactionsModel } from '../models/';
import txSchema from '../schema/logic/transaction';
import { DBBulkCreateOp, DBOp } from '../types/genericTypes';
import { SignedAndChainedBlockType, SignedBlockType } from './block';
import { BaseTransactionType, IBaseTransaction,
         IBytesTransaction, IConfirmedTransaction, ITransportTransaction } from './transactions/';

@injectable()
export class TransactionLogic implements ITransactionLogic {

  @inject(Symbols.helpers.exceptionsManager)
  public excManager: ExceptionsManager;

  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  @inject(Symbols.helpers.ed)
  private ed: Ed;

  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  @inject(Symbols.helpers.slots)
  private slots: Slots;

  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;

  private types: { [k: number]: BaseTransactionType<any, any> } = {};

  public attachAssetType<K, M extends Model<any>>(instance: BaseTransactionType<K, M>): BaseTransactionType<K, M> {
    if (!(instance instanceof BaseTransactionType)) {
      throw new Error('Invalid instance interface');
    }
    this.types[instance.type] = instance;
    return instance;
  }

  /**
   * Creates and returns signature
   * @returns {string} signature
   */
  public sign(keypair: IKeypair, tx: IBaseTransaction<any>) {
    const hash = this.getHash(tx);
    return this.ed.sign(hash, keypair).toString('hex');
  }

  /**
   * Creates a signature based on multisignatures
   * @returns {string} signature
   */
  public multiSign(keypair: IKeypair, tx: IBaseTransaction<any>) {
    const hash = this.getHash(tx, true, true);
    return this.ed.sign(hash, keypair).toString('hex');
  }

  /**
   * Calculate tx id
   * @returns {string} the id.
   */
  public getId(tx: IBaseTransaction<any>): string {
    const hash = this.getHash(tx);
    const temp = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
      temp[i] = hash[7 - i];
    }

    return BigNum.fromBuffer(temp).toString();
  }

  /**
   * Hash for the transaction
   */
  public getHash(tx: IBaseTransaction<any>, skipSign: boolean = false, skipSecondSign: boolean = false): Buffer {
    return crypto.createHash('sha256').update(this.getBytes(tx, skipSign, skipSecondSign)).digest();
  }

  /**
   * Return the transaction bytes.
   * @returns {Buffer}
   */
  public getBytes(tx: IBaseTransaction<any>,
                  skipSignature: boolean = false, skipSecondSignature: boolean = false): Buffer {
    if (!(tx.type in this.types)) {
      throw new Error(`Unknown transaction type ${tx.type}`);
    }

    const txType = this.types[tx.type];

    const assetBytes = txType.getBytes(tx, skipSignature, skipSecondSignature);

    const bb = new ByteBuffer(1 + 4 + 32 + 32 + 8 + 8 + 64 + 64 + assetBytes.length, true);

    bb.writeByte(tx.type);
    bb.writeInt(tx.timestamp);

    const senderPublicKeyBuffer = Buffer.isBuffer(tx.senderPublicKey) ?
      tx.senderPublicKey : Buffer.from(tx.senderPublicKey, 'hex');
    // tslint:disable-next-line
    for (let i = 0; i < senderPublicKeyBuffer.length; i++) {
      bb.writeByte(senderPublicKeyBuffer[i]);
    }

    if (tx.requesterPublicKey) {
      const requesterPublicKey = Buffer.isBuffer(tx.requesterPublicKey) ?
        tx.requesterPublicKey : Buffer.from(tx.requesterPublicKey, 'hex');
      // tslint:disable-next-line
      for (let i = 0; i < requesterPublicKey.length; i++) {
        bb.writeByte(requesterPublicKey[i]);
      }
    }

    if (tx.recipientId) {
      const recipient = tx.recipientId.slice(0, -1);
      const recBuf    = new BigNum(recipient).toBuffer({ size: 8 });

      for (let i = 0; i < 8; i++) {
        bb.writeByte(recBuf[i] || 0);
      }
    } else {
      for (let i = 0; i < 8; i++) {
        bb.writeByte(0);
      }
    }

    // tslint:disable-next-line
    bb['writeLong'](tx.amount);

    if (assetBytes.length > 0) {
      // tslint:disable-next-line
      for (let i = 0; i < assetBytes.length; i++) {
        bb.writeByte(assetBytes[i]);
      }
    }

    if (!skipSignature && tx.signature) {
      const signatureBuffer = Buffer.isBuffer(tx.signature) ?
        tx.signature : Buffer.from(tx.signature, 'hex');
      // tslint:disable-next-line
      for (let i = 0; i < signatureBuffer.length; i++) {
        bb.writeByte(signatureBuffer[i]);
      }
    }

    if (!skipSecondSignature && tx.signSignature) {
      const signSignatureBuffer = Buffer.isBuffer(tx.signSignature) ?
        tx.signSignature : Buffer.from(tx.signSignature, 'hex');
      // tslint:disable-next-line
      for (let i = 0; i < signSignatureBuffer.length; i++) {
        bb.writeByte(signSignatureBuffer[i]);
      }
    }

    bb.flip();

    return bb.toBuffer() as any;
  }

  // tslint:disable-next-line
  public fromBytes(tx: IBytesTransaction): IBaseTransaction<any> {
    const bb = ByteBuffer.wrap(tx.bytes, 'binary', true);
    const type = bb.readByte(0);
    const timestamp = bb.readInt(1);
    const senderPublicKey = new Buffer(bb.copy(5, 37).toBuffer());
    let requesterPublicKey = null;
    let offset = 37;

    // Read requesterPublicKey if available
    if (tx.hasRequesterPublicKey) {
      requesterPublicKey = bb.copy(offset, offset + 32).toBuffer() as any;
      offset += 32;
    }

    // RecipientId is valid only if it's not 8 bytes with 0 value
    const recipientIdBytes = bb.copy(offset, offset + 8);
    offset += 8;
    let recipientValid = false;
    for (let i = 0; i < 8; i++) {
      if (recipientIdBytes.readByte(i) !== 0) {
        recipientValid = true;
        break;
      }
    }
    const recipientId = recipientValid ?
      BigNum.fromBuffer(recipientIdBytes.toBuffer() as any).toString() + 'R' : null;

    const amount = bb.readLong(offset);
    offset += 8;

    const signature = bb.copy(bb.buffer.length - 64, bb.buffer.length).toBuffer() as any;

    // Read signSignature if available
    const signSignature = tx.hasSignSignature ?
      bb.copy(bb.buffer.length - 128, bb.buffer.length - 64) as any : null;

    // All remaining bytes between amount and signSignature (or signature) are the asset.
    let assetBytes = null;
    const optionalElementsLength = (tx.hasRequesterPublicKey ? 32 : 0) + (tx.hasSignSignature ? 64 : 0);
    const assetLength = bb.buffer.length - ( 1 + 4 + 32 + 8 + 8 + 64 + optionalElementsLength);
    if (assetLength < 0) {
      throw new Error('Buffer length does not match expected sequence');
    } else if (assetLength > 0) {
      assetBytes = bb.copy(offset, offset + assetLength);
    }

    const transaction: IBaseTransaction<any> =  {
      amount: amount.toNumber(),
      fee: tx.fee,
      id: this.getIdFromBytes(tx.bytes),
      recipientId,
      requesterPublicKey,
      senderId: this.accountLogic.generateAddressByPublicKey(senderPublicKey),
      senderPublicKey,
      signature,
      timestamp,
      type,
    };
    if (tx.hasRequesterPublicKey) {
      transaction.requesterPublicKey = requesterPublicKey;
    }
    if (tx.hasSignSignature) {
      transaction.signSignature = signSignature;
    }
    transaction.asset = this.types[type].fromBytes(assetBytes, transaction);
    return transaction;
  }

  public ready(tx: IBaseTransaction<any>, sender: AccountsModel): boolean {
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
  @RunThroughExceptions(ExceptionsList.checkBalance)
  public checkBalance(amount: number | BigNumber, balanceKey: 'balance' | 'u_balance',
                      tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: AccountsModel) {
    const accountBalance  = sender[balanceKey].toString();
    const exceededBalance = new BigNum(accountBalance).isLessThan(amount);
    // tslint:disable-next-line
    const exceeded        = (tx['blockId'] !== this.genesisBlock.id && exceededBalance);
    return {
      error: exceeded ? `Account does not have enough currency: ${sender.address} balance: ${
        new BigNum(accountBalance || 0).div(Math.pow(10, 8))} - ${new BigNum(amount).div(Math.pow(10, 8))}` : null,
      exceeded,
    };
  }

  public async verify(tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: AccountsModel,
                      requester: AccountsModel, height: number) {
    this.assertKnownTransactionType(tx.type);
    if (!sender) {
      throw new Error('Missing sender');
    }

    const txID = this.getId(tx);
    if (txID !== tx.id) {
      throw new Error('Invalid transaction id');
    }

    if (tx.requesterPublicKey && (!sender.isMultisignature() || requester == null)) {
      throw new Error('Account or requester account is not multisignature');
    }

    if (tx.requesterPublicKey && sender.secondSignature && !tx.signSignature &&
      (tx as IConfirmedTransaction<any>).blockId !== this.genesisBlock.id) {
      throw new Error('Missing sender second signature');
    }

    // If second signature provided, check if sender has one enabled
    if (!tx.requesterPublicKey && !sender.secondSignature && (tx.signSignature && tx.signSignature.length > 0)) {
      throw new Error('Sender does not have a second signature');
    }

    // Check for missing requester second signature
    if (tx.requesterPublicKey && requester.secondSignature && !tx.signSignature) {
      throw new Error('Missing requester second signature');
    }

    // If second signature provided, check if requester has one enabled
    if (tx.requesterPublicKey && !requester.secondSignature && (tx.signSignature && tx.signSignature.length > 0)) {
      throw new Error('Requester does not have a second signature');
    }

    // Check sender public key
    if (sender.publicKey && !sender.publicKey.equals(tx.senderPublicKey)) {
      // tslint:disable-next-line
      throw new Error(`Invalid sender public key: ${tx.senderPublicKey.toString('hex')} expected ${sender.publicKey.toString('hex')}`);
    }

    // Check sender is not genesis account unless block id equals genesis
    if (this.genesisBlock.generatorPublicKey.equals(sender.publicKey)
      && (tx as IConfirmedTransaction<any>).blockId !== this.genesisBlock.id) {
      throw new Error('Invalid sender. Can not send from genesis account');
    }

    if (String(tx.senderId).toUpperCase() !== String(sender.address).toUpperCase()) {
      throw new Error('Invalid sender address');
    }

    const multisignatures = (sender.multisignatures || sender.u_multisignatures || []).slice();

    if (tx.asset && tx.asset.multisignature && tx.asset.multisignature.keysgroup) {
      for (const key of tx.asset.multisignature.keysgroup) {
        if (!key || typeof key !== 'string') {
          throw new Error('Invalid member in keysgroup');
        }
        multisignatures.push(key.slice(1));
      }
    } else if (tx.requesterPublicKey) {
      if (sender.multisignatures.indexOf(tx.requesterPublicKey.toString('hex')) < 0) {
        throw new Error('Account does not belong to multisignature group');
      }
    }

    if (!this.verifySignature(
      tx,
      (tx.requesterPublicKey || tx.senderPublicKey),
      tx.signature,
      VerificationType.SIGNATURE)) {

      throw new Error('Failed to verify signature');
    }

    if (sender.secondSignature) {
      if (!this.verifySignature(tx, sender.secondPublicKey, tx.signSignature, VerificationType.SECOND_SIGNATURE)) {
        throw new Error('Failed to verify second signature');
      }
    }

    // In multisig accounts
    if (Array.isArray(tx.signatures) && tx.signatures.length > 0) {
      // check that signatures are unique.
      const duplicatedSignatures = tx.signatures.filter((sig, idx, arr) => arr.indexOf(sig) !== idx);
      if (duplicatedSignatures.length > 0) {
        throw new Error('Encountered duplicate signature in transaction');
      }

      // Verify multisignatures are valid and belong to some of prev. calculated multisignature publicKey
      for (const sig of tx.signatures) {
        let valid = false;
        for (let s = 0; s < multisignatures.length && !valid; s++) {
          valid = this.verifySignature(
            tx,
            Buffer.from(multisignatures[s], 'hex'),
            Buffer.from(sig, 'hex'),
            VerificationType.ALL
          );
        }

        if (!valid) {
          throw new Error('Failed to verify multisignature');
        }
      }
    }

    // Check fee
    const fee = this.types[tx.type].calculateFee(tx, sender, height);
    if (fee !== tx.fee) {
      throw new Error('Invalid transaction fee');
    }

    // Check amount
    if (tx.amount < 0 || // no negative amount
      tx.amount > constants.totalAmount || // cant go beyond totalAmount
      Math.floor(tx.amount) !== tx.amount || // Cant be decimal
      tx.amount.toString().indexOf('e') >= 0 // Cant be written in exponential notation
    ) {
      throw new Error('Invalid transaction amount');
    }

    // Check confirmed sender balance
    const amount        = new BigNum(tx.amount.toString()).plus(tx.fee.toString());
    const senderBalance = this.checkBalance(amount, 'balance', tx, sender);
    if (senderBalance.exceeded) {
      throw new Error(senderBalance.error);
    }

    // Check timestamp
    if (this.slots.getSlotNumber(tx.timestamp) > this.slots.getSlotNumber()) {
      throw new Error('Invalid transaction timestamp. Timestamp is in the future');
    }

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
  public verifySignature(tx: IBaseTransaction<any>, publicKey: Buffer, signature: Buffer,
                         verificationType: VerificationType): boolean {
    this.assertKnownTransactionType(tx.type);
    if (!signature) {
      return false;
    }
    // ALL
    let skipSign       = false;
    let skipSecondSign = false;
    switch (verificationType) {
      case VerificationType.SECOND_SIGNATURE:
        skipSecondSign = true;
        break;
      case VerificationType.SIGNATURE:
        skipSecondSign = skipSign = true;
        break;
    }
    return this.ed.verify(
      this.getHash(tx, skipSign, skipSecondSign),
      signature,
      publicKey
    );
  }

  @RunThroughExceptions(ExceptionsList.tx_apply)
  public async apply(tx: IConfirmedTransaction<any>,
                     block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    if (!this.ready(tx, sender)) {
      throw new Error('Transaction is not ready');
    }

    const amount        = new BigNum(tx.amount.toString()).plus(tx.fee.toString());
    const senderBalance = this.checkBalance(amount, 'balance', tx, sender);
    if (senderBalance.exceeded) {
      throw new Error(senderBalance.error);
    }

    const amountNumber = amount.toNumber();

    sender.balance -= amountNumber;
    this.logger.trace('Logic/Transaction->apply', {
      balance: -amountNumber,
      blockId: block.id,
      round  : this.roundsLogic.calcRound(block.height),
      sender : sender.address,
    });
    const ops = this.accountLogic.merge(sender.address, {
      balance: -amountNumber,
      blockId: block.id,
      round  : this.roundsLogic.calcRound(block.height),
    });
    ops.push(... await this.types[tx.type].apply(tx, block, sender));
    return ops;
  }

  /**
   * Merges account into sender address and calls undo to txtype
   * @returns {Promise<void>}
   */
  public async undo(tx: IConfirmedTransaction<any>,
                    block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    const amount: number = new BigNum(tx.amount.toString())
      .plus(tx.fee.toString())
      .toNumber();

    sender.balance += amount;
    this.logger.trace('Logic/Transaction->undo', {
      balance: amount,
      blockId: block.id,
      round  : this.roundsLogic.calcRound(block.height),
      sender : sender.address,
    });
    const ops = this.accountLogic.merge(
      sender.address,
      {
        balance: amount,
        blockId: block.id,
        round  : this.roundsLogic.calcRound(block.height),
      }
    );
    ops.push(... await this.types[tx.type].undo(tx, block, sender));
    return ops;
  }

  @RunThroughExceptions(ExceptionsList.tx_applyUnconfirmed)
  // tslint:disable-next-line max-line-length
  public async applyUnconfirmed(tx: IBaseTransaction<any>, sender: AccountsModel, requester?: AccountsModel): Promise<Array<DBOp<any>>> {
    // FIXME propagate requester?
    const amount        = new BigNum(tx.amount.toString()).plus(tx.fee.toString());
    const senderBalance = this.checkBalance(amount, 'u_balance', tx, sender);
    if (senderBalance.exceeded) {
      throw new Error(senderBalance.error);
    }

    const amountNumber = amount.toNumber();
    sender.u_balance -= amountNumber;

    const ops = this.accountLogic.merge(
      sender.address,
      { u_balance: -amountNumber }
    );
    ops.push(... await this.types[tx.type].applyUnconfirmed(tx, sender));
    return ops;
  }

  /**
   * Merges account into sender address with unconfirmed balance tx amount
   * Then calls undoUnconfirmed to the txType.
   */
  public async undoUnconfirmed(tx: IBaseTransaction<any>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    const amount: number = new BigNum(tx.amount.toString())
      .plus(tx.fee.toString())
      .toNumber();

    sender.u_balance += amount;

    const ops = this.accountLogic.merge(
      sender.address,
      { u_balance: amount }
    );
    ops.push(... await this.types[tx.type].undoUnconfirmed(tx, sender));
    return ops;
  }

  public dbSave(txs: Array<IBaseTransaction<any> & { senderId: string }>, blockId: string, height: number): Array<DBOp<any>> {
    if (txs.length === 0) {
      return [];
    }
    const bulkCreate: DBBulkCreateOp<TransactionsModel> = {
      model: this.TransactionsModel,
      type: 'bulkCreate',
      values: txs.map((tx) => {
        this.assertKnownTransactionType(tx.type);
        const senderPublicKey    = tx.senderPublicKey;
        const signature          = tx.signature;
        const signSignature      = tx.signSignature ? tx.signSignature : null;
        const requesterPublicKey = tx.requesterPublicKey ? tx.requesterPublicKey : null;
        return {
          // tslint:disable object-literal-sort-keys
          id         : tx.id,
          blockId,
          height,
          type       : tx.type,
          timestamp  : tx.timestamp,
          senderPublicKey,
          requesterPublicKey,
          senderId   : tx.senderId,
          recipientId: tx.recipientId || null,
          amount     : tx.amount,
          fee        : tx.fee,
          signature,
          signSignature,
          signatures : tx.signatures ? tx.signatures.join(',') : null,
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
  public objectNormalize(tx: IConfirmedTransaction<any>): IConfirmedTransaction<any>;
  // tslint:disable-next-line max-line-length
  public objectNormalize(tx2: IBaseTransaction<any> | ITransportTransaction<any> | IConfirmedTransaction<any>): IBaseTransaction<any> | IConfirmedTransaction<any> {
    const tx = {... tx2};
    this.assertKnownTransactionType(tx.type);
    for (const key in tx) {
      if (tx[key] === null || typeof(tx[key]) === 'undefined') {
        delete tx[key];
      }
    }
    // Convert hex encoded fields to Buffers (if they're not already buffers)
    ['senderPublicKey', 'requesterPublicKey', 'signature', 'signSignature'].forEach((k) => {
      if (typeof (tx[k]) === 'string') {
        tx[k] = Buffer.from(tx[k], 'hex');
      }
    });

    const report = this.schema.validate(tx, txSchema);

    if (!report) {
      throw new Error(`Failed to validate transaction schema: ${this.schema.getLastErrors().map((e) => e.message)
        .join(', ')}`);
    }
    // After processing the tx object becomes a IBaseTransaction<any>
    return this.types[tx.type].objectNormalize(tx as IBaseTransaction<any>);
  }

  public dbRead(raw: any): IConfirmedTransaction<any> {
    if (!raw.t_id) {
      return null;
    }
    // tslint:disable object-literal-sort-keys
    const tx: IConfirmedTransaction<any> = {
      id                : raw.t_id,
      height            : raw.b_height,
      blockId           : raw.b_id || raw.t_blockId,
      type              : parseInt(raw.t_type, 10),
      timestamp         : parseInt(raw.t_timestamp, 10),
      senderPublicKey   : raw.t_senderPublicKey,
      requesterPublicKey: raw.t_requesterPublicKey,
      senderId          : raw.t_senderId,
      recipientId       : raw.t_recipientId,
      recipientPublicKey: raw.m_recipientPublicKey || null,
      amount            : parseInt(raw.t_amount, 10),
      fee               : parseInt(raw.t_fee, 10),
      signature         : raw.t_signature,
      signSignature     : raw.t_signSignature,
      signatures        : raw.t_signatures ? raw.t_signatures.split(',') : [],
      confirmations     : parseInt(raw.confirmations, 10),
      asset             : {},
    };

    this.assertKnownTransactionType(tx.type);

    const asset = this.types[tx.type].dbRead(raw);
    if (asset) {
      tx.asset = asset;
    }
    return tx;
  }

  public async attachAssets(txs: Array<IConfirmedTransaction<any>>): Promise<void> {
    if (txs === null) {
      return;
    }
    const txsByGroup = _.groupBy(txs, (i) => i.type);
    for (const type in txsByGroup) {
      const loopTXs = txsByGroup[type];
      this.assertKnownTransactionType(loopTXs[0].type);
      await this.types[loopTXs[0].type].attachAssets(loopTXs);
    }
  }

  /**
   * Calculate tx id from getBytes() output
   * @returns {string} the id.
   */
  private getIdFromBytes(bytes: Buffer): string {
    const hash = crypto.createHash('sha256').update(bytes).digest();
    const temp = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
      temp[i] = hash[7 - i];
    }
    return BigNum.fromBuffer(temp).toString();
  }

}
