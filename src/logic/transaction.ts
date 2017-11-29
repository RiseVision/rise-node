import {BigNumber} from 'bignumber.js';
import * as ByteBuffer from 'bytebuffer';
import * as crypto from 'crypto';
import z_schema from 'z-schema';
import sql from '../../sql/logic/transactions';
import {BigNum, constants, Ed, emptyCB, IKeypair, ILogger, Slots, TransactionType} from '../helpers/';
import {RoundsModule} from '../modules/';
import txSchema from '../schema/logic/transaction';
import {AccountLogic, MemAccountsData} from './account';
import { SignedAndChainedBlockType, SignedBlockType } from './block';
import {BaseTransactionType, IBaseTransaction, IConfirmedTransaction} from './transactions/';

// tslint:disable-next-line
export type TransactionLogicScope = {
  db: any,
  ed: Ed,
  schema: z_schema,
  genesisblock: SignedAndChainedBlockType,
  account: AccountLogic,
  logger: ILogger
};

export class TransactionLogic {
  public dbTable  = 'trs';
  public dbFields = [
    'id',
    'blockId',
    'type',
    'timestamp',
    'senderPublicKey',
    'requesterPublicKey',
    'senderId',
    'recipientId',
    'amount',
    'fee',
    'signature',
    'signSignature',
    'signatures',
  ];

  public modules: { rounds: RoundsModule };

  private types: { [k: number]: BaseTransactionType<any> } = {};

  constructor(public scope: TransactionLogicScope) {
  }

  public bindModules(modules: { rounds: any }) {
    this.modules = modules;
  }

  public attachAssetType<K, T extends BaseTransactionType<K>>(type: TransactionType, instance: T): T {
    if (!(instance instanceof BaseTransactionType)) {
      throw new Error('Invalid instance interface');
    }
    this.types[type] = instance;
    return instance;
  }

  /**
   * Creates and returns signature
   * @returns {string} signature
   */
  public sign(keypair: IKeypair, tx: IBaseTransaction<any>) {
    const hash = this.getHash(tx);
    return this.scope.ed.sign(hash, keypair).toString('hex');
  }

  /**
   * Creates a signature based on multisignatures
   * @returns {string} signature
   */
  public multiSign(keypair: IKeypair, tx: IBaseTransaction<any>) {
    const hash = this.getHash(tx, true, true);
    return this.scope.ed.sign(hash, keypair).toString('hex');
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

    const senderPublicKeyBuffer = Buffer.from(tx.senderPublicKey, 'hex');
    // tslint:disable-next-line
    for (let i = 0; i < senderPublicKeyBuffer.length; i++) {
      bb.writeByte(senderPublicKeyBuffer[i]);
    }

    if (tx.requesterPublicKey) {
      const requesterPublicKey = Buffer.from(tx.requesterPublicKey, 'hex');
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
      const signatureBuffer = Buffer.from(tx.signature, 'hex');
      // tslint:disable-next-line
      for (let i = 0; i < signatureBuffer.length; i++) {
        bb.writeByte(signatureBuffer[i]);
      }
    }

    if (!skipSecondSignature && tx.signSignature) {
      const signSignatureBuffer = Buffer.from(tx.signSignature, 'hex');
      // tslint:disable-next-line
      for (let i = 0; i < signSignatureBuffer.length; i++) {
        bb.writeByte(signSignatureBuffer[i]);
      }
    }

    bb.flip();

    return bb.toBuffer() as any;
  }

  public ready(tx: IBaseTransaction<any>, sender: MemAccountsData): boolean {
    this.assertKnownTransactionType(tx);

    if (!sender) {
      return false;
    }

    return this.types[tx.type].ready(tx, sender);
  }

  public assertKnownTransactionType(tx: IBaseTransaction<any>) {
    if (!(tx.type in this.types)) {
      throw new Error(`Unknown transaction type ${tx.type}`);
    }
  }

  /**
   * Counts transaction by id
   * @returns {Promise<number>}
   */
  public async countById(tx: IBaseTransaction<any>): Promise<number> {
    try {
      const { count } = await this.scope.db.one(sql.countById, { id: tx.id });
      return count;
    } catch (e) {
      this.scope.logger.error(e.stack);
      throw new Error('Transaction#countById error');
    }
  }

  /**
   * Checks the tx is not confirmed or rejects otherwise
   */
  public async assertNonConfirmed(tx: IBaseTransaction<any>): Promise<void> {
    const count = await this.countById(tx);
    if (count > 0) {
      throw new Error(`Transaction is already confirmed ${tx.id}`);
    }
  }

  /**
   * Checks if balanceKey is less than amount for sender
   */
  public checkBalance(amount: number | BigNumber, balanceKey: 'balance' | 'u_balance',
                      tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: any) {
    const accountBalance  = sender[balanceKey].toString();
    const exceededBalance = new BigNum(accountBalance).lessThan(amount);
    // tslint:disable-next-line
    const exceeded        = (tx['blockId'] !== this.scope.genesisblock.id && exceededBalance);
    return {
      error: exceeded ? `Account does not have enough currency: ${sender.address} balance: ${
        (accountBalance || new BigNum(0)).div(Math.pow(10, 8))}` : null,
      exceeded,
    };
  }

  /**
   * Performs some validation on the transaction and calls process
   * to the respective tx type.
   */
  public async process<T = any>(tx: IBaseTransaction<T>, sender: any, requester: string): Promise<IBaseTransaction<T>> {
    this.assertKnownTransactionType(tx);
    if (!sender) {
      throw new Error('Missing sender');
    }

    const txID = this.getId(tx);
    if (txID !== tx.id) {
      throw new Error('Invalid transaction id');
    }

    // TODO: TS fix me
    (tx as any).senderId = sender.address;

    await this.types[tx.type].process(tx, sender);
    return tx;
  }

  public async verify(tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: MemAccountsData,
                      requester: any, height: number) {
    this.assertKnownTransactionType(tx);
    if (!sender) {
      throw new Error('Missing sender');
    }

    if (tx.requesterPublicKey && sender.secondSignature && !tx.signSignature &&
      (tx as IConfirmedTransaction<any>).blockId !== this.scope.genesisblock.id) {
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
    if (sender.publicKey && sender.publicKey !== tx.senderPublicKey) {
      throw new Error(`Invalid sender public key: ${tx.senderPublicKey} expected ${sender.publicKey}`);
    }

    // Check sender is not genesis account unless block id equals genesis
    if (this.scope.genesisblock.generatorPublicKey === sender.publicKey
      && (tx as IConfirmedTransaction<any>).blockId !== this.scope.genesisblock.id) {
      throw new Error('Invalid sender. Can not send from genesis account');
    }

    if (String((tx as any).senderId).toUpperCase() !== String(sender.address).toUpperCase()) {
      throw new Error('Invalid sender address');
    }

    const multisignatures = sender.multisignatures || sender.u_multisignatures || [];
    if (multisignatures.length === 0) {
      if (tx.asset && tx.asset.multisignature && tx.asset.multisignature.keysgroup) {
        for (const key of tx.asset.multisignature.keysgroup) {
          if (!key || typeof key !== 'string') {
            throw new Error('Invalid member in keysgroup');
          }
          multisignatures.push(key.slice(1));
        }
      }
    }

    if (tx.requesterPublicKey) {
      multisignatures.push(tx.requesterPublicKey);
      if (sender.multisignatures.indexOf(tx.requesterPublicKey) < 0) {
        throw new Error('Account does not belong to multisignature group');
      }
    }

    if (!this.verifySignature(tx, (tx.requesterPublicKey || tx.senderPublicKey), tx.signature)) {
      throw new Error('Failed to verify signature');
    }

    if (sender.secondSignature) {
      if (!this.verifySignature(tx, sender.secondPublicKey, tx.signSignature, true)) {
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
          if (tx.requesterPublicKey && multisignatures[s] === tx.requesterPublicKey) {
            continue;
          }
          valid = this.verifySignature(tx, multisignatures[s], sig);
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
    if (Slots.getSlotNumber(tx.timestamp) > Slots.getSlotNumber()) {
      throw new Error('Invalid transaction timestamp. Timestamp is in the future');
    }

    await this.types[tx.type].verify(tx, sender);
    await this.assertNonConfirmed(tx);
  }

  /**
   * Verifies the given signature (both first and second)
   * @param {IBaseTransaction<any>} tx
   * @param {string} publicKey
   * @param {string} signature
   * @param {boolean} isSecondSignature if true, then this will check agains secondsignature
   * @returns {boolean} true
   */
  public verifySignature(tx: IBaseTransaction<any>, publicKey: string, signature: string,
                         isSecondSignature: boolean = false) {
    this.assertKnownTransactionType(tx);
    if (!signature) {
      return false;
    }

    return this.scope.ed.verify(
      this.getHash(tx, !isSecondSignature, true),
      Buffer.from(signature, 'hex'),
      Buffer.from(publicKey, 'hex')
    );
  }

  public async apply(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: any): Promise<void> {
    if (!this.ready(tx, sender)) {
      throw new Error('Transaction is not ready');
    }

    const amount        = new BigNum(tx.amount.toString()).plus(tx.fee.toString());
    const senderBalance = this.checkBalance(amount, 'balance', tx, sender);
    if (senderBalance.exceeded) {
      throw new Error(senderBalance.error);
    }

    const amountNumber = amount.toNumber();

    this.scope.logger.trace('Logic/Transaction->apply', {
      balance: -amountNumber,
      blockId: block.id,
      round  : this.modules.rounds.calcRound(block.height),
      sender : sender.address,
    });
    await this.scope.account.merge(
      sender.address,
      {
        balance: -amountNumber,
        blockId: block.id,
        round  : this.modules.rounds.calcRound(block.height),
      } as any, // TODO: round is not defined in typescript definition. Possible bug?
      // tslint:disable-next-line no-empty
      () => {
      } // If you don't pass cb then the sql string is returned.
    );

    try {
      await this.types[tx.type].apply(tx, block, sender);
    } catch (e) {
      // Rollback!
      await this.scope.account.merge(
        sender.address,
        {
          balance: amountNumber,
          blockId: block.id,
          round  : this.modules.rounds.calcRound(block.height),
        },
        // tslint:disable-next-line no-empty
        () => {
        }
      );
      // here it differs from original implementation which did not throw
      throw e;
    }
  }

  /**
   * Merges account into sender address and calls undo to txtype
   * @returns {Promise<void>}
   */
  public async undo(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: any): Promise<void> {
    const amount: number = new BigNum(tx.amount.toString())
      .plus(tx.fee.toString())
      .toNumber();

    this.scope.logger.trace('Logic/Transaction->undo', {
      balance: amount,
      blockId: block.id,
      round  : this.modules.rounds.calcRound(block.height),
      sender : sender.address,
    });
    const mergedSender = await this.scope.account.merge(
      sender.address,
      {
        balance: amount,
        blockId: block.id,
        round  : this.modules.rounds.calcRound(block.height),
      },
      emptyCB
    );

    try {
      await this.types[tx.type].undo(tx, block, mergedSender);
    } catch (e) {
      // Rollback
      await this.scope.account.merge(
        sender.address,
        {
          balance: -amount,
          blockId: block.id,
          round  : this.modules.rounds.calcRound(block.height),
        },
        emptyCB
      );
      throw e;
    }
  }

  public async applyUnconfirmed(tx: IBaseTransaction<any>, sender: any, requester?: any): Promise<void> {
    // FIXME propagate requester?
    const amount        = new BigNum(tx.amount.toString()).plus(tx.fee.toString());
    const senderBalance = this.checkBalance(amount, 'u_balance', tx, sender);
    if (senderBalance.exceeded) {
      throw new Error(senderBalance.error);
    }

    const amountNumber = amount.toNumber();

    await this.scope.account.merge(
      sender.address,
      { u_balance: -amountNumber },
      emptyCB
    );
    try {
      await this.types[tx.type].applyUnconfirmed(tx, sender);
    } catch (e) {
      // RollBack
      await this.scope.account.merge(
        sender.address,
        { u_balance: amountNumber },
        emptyCB
      );
      throw e;
    }
  }

  /**
   * Merges account into sender address with unconfirmed balance tx amount
   * Then calls undoUnconfirmed to the txType.
   */
  public async undoUnconfirmed(tx: IBaseTransaction<any>, sender: any): Promise<void> {
    const amount: number = new BigNum(tx.amount.toString())
      .plus(tx.fee.toString())
      .toNumber();

    const mergedSender = await this.scope.account.merge(
      sender.address,
      { u_balance: amount },
      emptyCB
    );

    try {
      await this.types[tx.type].undoUnconfirmed(tx, mergedSender);
    } catch (e) {
      // Rollback
      await this.scope.account.merge(
        sender.address,
        { u_balance: -amount },
        emptyCB
      );
      throw e;
    }
  }

  public dbSave(tx: IConfirmedTransaction<any> & { senderId: string }): Array<{
    table: string, fields: string[], values: any
  }> {
    this.assertKnownTransactionType(tx);
    const senderPublicKey    = Buffer.from(tx.senderPublicKey, 'hex');
    const signature          = Buffer.from(tx.signature, 'hex');
    const signSignature      = tx.signSignature ? Buffer.from(tx.signSignature, 'hex') : null;
    const requesterPublicKey = tx.requesterPublicKey ? Buffer.from(tx.requesterPublicKey, 'hex') : null;

    // tslint:disable object-literal-sort-keys
    const toRet = [{
      table : this.dbTable,
      fields: this.dbFields,
      values: {
        id         : tx.id,
        blockId    : tx.blockId,
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
      },
    }];
    // tslint:enable object-literal-sort-keys

    const typeSQL = this.types[tx.type].dbSave(tx);
    if (typeSQL) {
      toRet.push(typeSQL);
    }
    return toRet;
  }

  public afterSave(tx: IBaseTransaction<any>): Promise<void> {
    this.assertKnownTransactionType(tx);
    return this.types[tx.type].afterSave(tx);
  }

  /**
   * Epurates the tx object by removing null and undefined fields
   * Pass it through schema validation and then calls subtype objectNormalize.
   */
  public objectNormalize(tx: IBaseTransaction<any>): IBaseTransaction<any> {
    this.assertKnownTransactionType(tx);
    for (const key in tx) {
      if (tx[key] === null || typeof(tx[key]) === 'undefined') {
        delete tx[key];
      }
    }

    const report = this.scope.schema.validate(tx, txSchema);

    if (!report) {
      throw new Error(`Failed to validate transaction schema: ${this.scope.schema.getLastErrors().map((e) => e.message)
        .join(', ')}`);
    }

    return this.types[tx.type].objectNormalize(tx);
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

    this.assertKnownTransactionType(tx);

    const asset = this.types[tx.type].dbRead(raw);
    if (asset) {
      tx.asset = asset;
    }
    return tx;
  }
}
