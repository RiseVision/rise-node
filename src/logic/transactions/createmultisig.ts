import * as ByteBuffer from 'bytebuffer';
import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import * as SocketIO from 'socket.io';
import * as z_schema from 'z-schema';
import { constants, Diff, TransactionType } from '../../helpers/';
import { IAccountLogic, IRoundsLogic, ITransactionLogic, VerificationType } from '../../ioc/interfaces/logic';
import { ISystemModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import {
  Accounts2MultisignaturesModel,
  Accounts2U_MultisignaturesModel,
  AccountsModel,
  MultiSignaturesModel,
  TransactionsModel
} from '../../models/';
import multiSigSchema from '../../schema/logic/transactions/multisignature';
import { DBCreateOp, DBOp, DBUpsertOp } from '../../types/genericTypes';
import { SignedBlockType } from '../block';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';
import { VoteAsset } from './vote';

// tslint:disable-next-line interface-over-type-literal
export type MultisigAsset = {
  multisignature: {
    min: number;
    lifetime: number;
    keysgroup: string[];
  }
};

@injectable()
export class MultiSignatureTransaction extends BaseTransactionType<MultisigAsset, MultiSignaturesModel> {

  private unconfirmedSignatures: { [name: string]: true };

  // Generics
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  // Logic
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;
  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(Symbols.models.multisignatures)
  private MultiSignaturesModel: typeof MultiSignaturesModel;
  @inject(Symbols.models.accounts2Multisignatures)
  private Accounts2MultisignaturesModel: typeof Accounts2MultisignaturesModel;
  @inject(Symbols.models.accounts2U_Multisignatures)
  private Accounts2UMultisignaturesModel: typeof Accounts2U_MultisignaturesModel;
  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;

  constructor() {
    super(TransactionType.MULTI);
    this.unconfirmedSignatures = {};
  }

  public calculateFee(tx: IBaseTransaction<MultisigAsset>, sender: any, height: number): number {
    return this.systemModule.getFees(height).fees.multisignature;
  }

  public getBytes(tx: IBaseTransaction<MultisigAsset>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    const keysBuff = Buffer.from(tx.asset.multisignature.keysgroup.join(''), 'utf8');
    const bb       = new ByteBuffer(1 + 1 + keysBuff.length, true);
    bb.writeByte(tx.asset.multisignature.min);
    bb.writeByte(tx.asset.multisignature.lifetime);

    // tslint:disable-next-line
    for (let i = 0; i < keysBuff.length; i++) {
      bb.writeByte(keysBuff[i]);
    }
    bb.flip();

    return bb.toBuffer() as any;
  }

  /**
   * Returns asset, given Buffer containing it
   */
  public fromBytes(bytes: Buffer, tx: IBaseTransaction<any>): MultisigAsset {
    if (bytes === null) {
      return null;
    }
    const bb = ByteBuffer.wrap(bytes, 'binary');
    const min = bb.readByte(1);
    const lifetime = bb.readByte(2);
    const keysString = bb.copy(3, bb.buffer.length).toString('hex');
    // Cut keys string into 32-bytes chunks
    const keysgroup = [].concat.apply([],
      keysString.split('').map(
        (x, i) => i % 64 ? [] : keysString.slice(i, i + 64)
      )
    );
    return {
      multisignature: {
        keysgroup,
        lifetime,
        min,
      },
    };
  }

  public async verify(tx: IBaseTransaction<MultisigAsset>, sender: AccountsModel): Promise<void> {
    if (!tx.asset || !tx.asset.multisignature) {
      throw new Error('Invalid transaction asset');
    }

    if (!Array.isArray(tx.asset.multisignature.keysgroup)) {
      throw new Error('Invalid multisignature keysgroup. Must be an array');
    }

    if (tx.asset.multisignature.keysgroup.length === 0) {
      throw new Error('Invalid multisignature keysgroup. Must not be empty');
    }

    // check multisig asset is valid hex publickeys
    for (const key of tx.asset.multisignature.keysgroup) {
      if (!key || typeof(key) !== 'string' || key.length !== 64 + 1) {
        throw new Error('Invalid member in keysgroup');
      }
    }

    if (tx.asset.multisignature.min < constants.multisigConstraints.min.minimum ||
      tx.asset.multisignature.min > constants.multisigConstraints.min.maximum) {
      throw new Error(`Invalid multisignature min. Must be between ${constants.multisigConstraints.min.minimum} and ${
        constants.multisigConstraints.min.maximum}`);
    }

    if (tx.asset.multisignature.min > tx.asset.multisignature.keysgroup.length) {
      throw new Error('Invalid multisignature min. Must be less than or equal to keysgroup size');
    }

    if (tx.asset.multisignature.lifetime < constants.multisigConstraints.lifetime.minimum ||
      tx.asset.multisignature.lifetime > constants.multisigConstraints.lifetime.maximum) {
      throw new Error(`Invalid multisignature lifetime. Must be between ${constants.multisigConstraints
        .lifetime.minimum} and ${constants.multisigConstraints.lifetime.maximum}`);
    }

    if (tx.recipientId) {
      throw new Error('Invalid recipient');
    }

    if (tx.amount !== 0) {
      throw new Error('Invalid transaction amount');
    }

    if (this.ready(tx, sender)) {
      for (const key of tx.asset.multisignature.keysgroup) {
        let valid = false;
        if (Array.isArray(tx.signatures)) {
          for (let i = 0; i < tx.signatures.length && !valid; i++) {
            if (key[0] === '+' || key[0] === '-') {
              valid = this.transactionLogic.verifySignature(
                tx,
                Buffer.from(key.substring(1), 'hex'),
                Buffer.from(tx.signatures[i], 'hex'),
                VerificationType.ALL
              );
            }
          }
        }

        if (!valid) {
          throw new Error('Failed to verify signature in multisignature keysgroup');
        }
      }
    }

    if (tx.asset.multisignature.keysgroup.indexOf(`+${sender.publicKey.toString('hex')}`) !== -1) {
      throw new Error('Invalid multisignature keysgroup. Cannot contain sender');
    }

    for (const key of tx.asset.multisignature.keysgroup) {
      if (typeof(key) !== 'string') {
        throw new Error('Invalid member in keysgroup');
      }

      const sign   = key[0];
      const pubKey = key.substring(1);
      if (sign !== '+') {
        throw new Error('Invalid math operator in multisignature keysgroup');
      }

      if (!this.schema.validate(pubKey, { format: 'publicKey' })) {
        throw new Error('Invalid publicKey in multisignature keysgroup');
      }
    }

    // Check for duplicated keys
    if (tx.asset.multisignature.keysgroup.filter((k, i, a) => a.indexOf(k) !== i).length > 0) {
      throw new Error('Encountered duplicate public key in multisignature keysgroup');
    }
  }

  public async apply(tx: IConfirmedTransaction<MultisigAsset>,
                     block: SignedBlockType,
                     sender: AccountsModel): Promise<Array<DBOp<any>>> {
    delete this.unconfirmedSignatures[sender.address];
    return this.calcOps('confirmed', tx.asset, block.id, sender);
  }

  public async undo(tx: IConfirmedTransaction<MultisigAsset>,
                    block: SignedBlockType,
                    sender: AccountsModel): Promise<Array<DBOp<any>>> {
    // to restore to the previous state we try to fetch the previous multisig transaction
    // if there is any then we apply that tx after rollbacking. otherwise we reset to 0 all the fields.
    // seek for prev txs for such account.
    const prevTX = await this.TransactionsModel.findOne<TransactionsModel<MultisigAsset>>({
      limit: 1,
      order: [['height', 'DESC']],
      where: {
        id      : { [Op.ne]: tx.id },
        senderId: sender.address,
        type    : TransactionType.MULTI,
      },
    });

    let asset: MultisigAsset;
    // If no previous tx then we create a "fake" resetting tx and we call apply that will reset
    // the account state given that the asset values are all empty.
    if (!prevTX) {
      asset = { multisignature: { min: 0, lifetime: 0, keysgroup: [] } };
    } else {
      await this.attachAssets([prevTX]);
      asset = prevTX.asset;
    }
    this.unconfirmedSignatures[sender.address] = true;
    return this.calcOps('confirmed', asset, '0', sender);
  }

  public async applyUnconfirmed(tx: IBaseTransaction<MultisigAsset>, sender: any): Promise<Array<DBOp<any>>> {
    if (this.unconfirmedSignatures[sender.address]) {
      throw new Error('Signature on this account is pending confirmation');
    }
    this.unconfirmedSignatures[sender.address] = true;
    return this.calcOps('unconfirmed', tx.asset, null, sender);
  }

  public async undoUnconfirmed(tx: IBaseTransaction<MultisigAsset>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    delete this.unconfirmedSignatures[sender.address];
    sender.u_multisignatures = (sender.multisignatures || []).slice();
    sender.u_multimin = sender.multimin;
    sender.u_multilifetime = sender.multilifetime;
    // Copy confirmed values over as most of the heavy lifting is done there.

    return [
      // clean up memaccounts2u_multisignatures
      {
        model  : this.Accounts2UMultisignaturesModel,
        type   : 'remove',
        options: { where: { accountId: sender.address } },
      },
      // copy confirmed values from 2_multisignatures to 2u_multisignatures.
      ... (sender.multisignatures || []).map((k) => ({
        model : this.Accounts2UMultisignaturesModel,
        type  : 'upsert',
        values: {
          accountId  : sender.address,
          dependentId: k,
        },
      } as DBUpsertOp<Accounts2U_MultisignaturesModel>)),
      //
      {
        model  : this.AccountsModel,
        options: { where: { address: tx.senderId } },
        type   : 'update',
        values : {
          u_multilifetime: sequelize.col('multilifetime'),
          u_multimin     : sequelize.col('multimin'),
        },
      },
    ];
  }

  public objectNormalize(tx: IBaseTransaction<MultisigAsset>): IBaseTransaction<MultisigAsset> {
    const report = this.schema.validate(tx.asset.multisignature, multiSigSchema);
    if (!report) {
      throw new Error(`Failed to validate multisignature schema: ${this.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
    }

    return tx;
  }

  public dbRead(raw: any): MultisigAsset {
    if (!raw.m_keysgroup) {
      return null;
    } else {
      const multisignature = {
        keysgroup: [],
        lifetime : raw.m_lifetime,
        min      : raw.m_min,
      };

      if (typeof raw.m_keysgroup === 'string') {
        multisignature.keysgroup = raw.m_keysgroup.split(',');
      }

      return { multisignature };
    }
  }

  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<MultisigAsset> & { senderId: string }): DBCreateOp<MultiSignaturesModel> {
    return {
      model : this.MultiSignaturesModel,
      type  : 'create',
      values: {
        keysgroup    : tx.asset.multisignature.keysgroup.join(','),
        lifetime     : tx.asset.multisignature.lifetime,
        min          : tx.asset.multisignature.min,
        transactionId: tx.id,
      },
    };
  }

  public afterSave(tx: IBaseTransaction<MultisigAsset>): Promise<void> {
    this.io.sockets.emit('multisignatures/change', tx);
    return Promise.resolve();
  }

  /**
   * Checks if the tx is ready to be confirmed.
   * So it checks if the tx has been cosigned by every member if new account or min members.
   * DOES not check the signatures validity but just the number.
   * @param {IBaseTransaction<any>} tx
   * @param sender
   * @returns {boolean}
   */
  public ready(tx: IBaseTransaction<any>, sender: AccountsModel): boolean {
    if (!Array.isArray(tx.signatures)) {
      return false;
    }
    const txKeys           = tx.type === TransactionType.MULTI ? tx.asset.multisignature.keysgroup.map((k) => k.substr(1)) : [];
    const accountKeys      = sender.isMultisignature() ? sender.multisignatures : [];
    const intersectionKeys = _.intersection(accountKeys, txKeys);

    // If account is multisig, to change keysgroup the tx needs to be signed by
    if (sender.isMultisignature()) {
      return tx.signatures.length >= txKeys.length + sender.multimin - intersectionKeys.length;
    } else {
      return tx.signatures.length === txKeys.length;
    }
  }

  public async attachAssets(txs: Array<IConfirmedTransaction<MultisigAsset>>) {
    const res = await this.MultiSignaturesModel
      .findAll({
        where: { transactionId: txs.map((tx) => tx.id) },
      });

    const indexes = {};
    res.forEach((tx, idx) => indexes[tx.transactionId] = idx);

    txs.forEach((tx) => {
      if (typeof(indexes[tx.id]) === 'undefined') {
        throw new Error(`Couldn't restore asset for Signature tx: ${tx.id}`);
      }
      const info = res[indexes[tx.id]];
      tx.asset   = {
        multisignature: {
          min: info.min,
          lifetime: info.lifetime,
          keysgroup: info.keysgroup.split(','),
        },
      };
    });
  }

  private calcOps(type: 'confirmed' | 'unconfirmed', asset: MultisigAsset, blockId: string, sender: AccountsModel): Array<DBOp<any>> {
    if (type === 'confirmed') {
      sender.multisignatures = [];
      sender.applyDiffArray('multisignatures', asset.multisignature.keysgroup);
      sender.applyValues({ multimin: asset.multisignature.min, multilifetime: asset.multisignature.lifetime });
    } else {
      sender.u_multisignatures = [];
      sender.applyDiffArray('u_multisignatures', asset.multisignature.keysgroup);
      sender.applyValues({ u_multimin: asset.multisignature.min, u_multilifetime: asset.multisignature.lifetime });
    }

    const ops: Array<DBOp<any>> = [];
    let updateValue: any;
    if (type === 'unconfirmed') {
      updateValue = {
        u_multilifetime: asset.multisignature.lifetime,
        u_multimin     : asset.multisignature.min,
      };
    } else {
      updateValue = {
        blockId,
        multilifetime: asset.multisignature.lifetime,
        multimin     : asset.multisignature.min,
      };
    }
    ops.push({
      model  : this.AccountsModel,
      options: { where: { address: sender.address } },
      type   : 'update',
      values : updateValue,
    });
    ops.push({
      model  : type === 'confirmed' ? this.Accounts2MultisignaturesModel : this.Accounts2UMultisignaturesModel,
      options: { where: { accountId: sender.address } },
      type   : 'remove',
    });

    // insert new entries to accounts2MultisignaturesModel
    // Generate accounts
    for (const key of asset.multisignature.keysgroup) {
      // index 0 has "+" or "-"
      const realKey = key.substr(1);
      const address = this.accountLogic.generateAddressByPublicKey(realKey);
      ops.push(
        {
          model : this.AccountsModel,
          type  : 'upsert',
          values: {
            address,
            publicKey: Buffer.from(realKey, 'hex'),
          },
        },
        {
          model : type === 'confirmed' ? this.Accounts2MultisignaturesModel : this.Accounts2UMultisignaturesModel,
          type  : 'create',
          values: {
            accountId  : sender.address,
            dependentId: realKey,
          },
        });

    }
    return ops;
  }
}
