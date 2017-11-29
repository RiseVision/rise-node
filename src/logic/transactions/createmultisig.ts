import * as ByteBuffer from 'bytebuffer';
import { constants, Diff, emptyCB, ILogger, TransactionType } from '../../helpers/';
import { AccountsModule, RoundsModule, SystemModule } from '../../modules/';
import multiSigSchema from '../../schema/logic/transactions/multisignature';
import { AccountLogic } from '../account';
import { SignedBlockType } from '../block';
import { TransactionLogic } from '../transaction';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';

// tslint:disable-next-line interface-over-type-literal
export type MultisigAsset = {
  multisignature: {
    min: number;
    lifetime: number;
    keysgroup: string[];
  }
};

export class MultiSignatureTransaction extends BaseTransactionType<MultisigAsset> {

  public modules: { accounts: AccountsModule, rounds: RoundsModule, sharedApi: any, system: SystemModule };
  private unconfirmedSignatures: { [name: string]: true };
  private dbTable  = 'multisignatures';
  private dbFields = [
    'min',
    'lifetime',
    'keysgroup',
    'transactionId',
  ];

  constructor(public library: {
    account: AccountLogic,
    logger: ILogger, schema: any, network: any, transaction: TransactionLogic
  }) {
    super(TransactionType.IN_TRANSFER);
  }

  public bind(accounts: AccountsModule, rounds: any, sharedApi: any, system: any) {
    this.modules = { accounts, rounds, sharedApi, system };
  }

  public calculateFee(tx: IBaseTransaction<MultisigAsset>, sender: any, height: number): number {
    return this.modules.system.getFees(height).fees.multisignature;
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

  public async verify(tx: IBaseTransaction<MultisigAsset>, sender: any): Promise<void> {
    if (!tx.asset || !tx.asset.multisignature) {
      throw new Error('Invalid transaction asset');
    }

    if (!Array.isArray(tx.asset.multisignature.keysgroup)) {
      throw new Error('Invalid multisignature keysgroup. Must be an array');
    }

    if (tx.asset.multisignature.keysgroup.length === 0) {
      throw new Error('Invalid multisignature keysgroup. Must not be empty');
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

    if (Array.isArray(sender.multisignatures) && sender.multisignatures.length > 0) {
      throw new Error('Account already has multisignatures enabled');
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
            if (key[0] === '-' || key === '-') {
              valid = this.library.transaction.verifySignature(tx, key.substring(1), tx.signature[i]);
            }
          }
        }

        if (!valid) {
          throw new Error('Failed to verify signature in multisgnature keysgroup');
        }
      }
    }

    if (tx.asset.multisignature.keysgroup.indexOf(`+${sender.publicKey}`) !== -1) {
      throw new Error('Invalid multisignature keysgroup. Cannot contain sender');
    }
    // TODO: Check secondPubliKey as well!

    for (const key of tx.asset.multisignature.keysgroup) {
      if (typeof(key) !== 'string') {
        throw new Error('Invalid member in keysgroup');
      }

      const sign   = key[0];
      const pubKey = key.substring(1);
      if (sign !== '+') {
        throw new Error('Invalid math operator in multisignature keysgroup');
      }

      if (!this.library.schema.validate(pubKey, { format: 'publicKey' })) {
        throw new Error('Invalid publicKey in multisignature keysgroup');
      }
    }

    // Check for duplicated keys
    if (tx.asset.multisignature.keysgroup.filter((k, i, a) => a.indexOf(k) !== i).length > 0) {
      throw new Error('Encountered duplicate public key in multisignature keysgroup');
    }
  }

  public async apply(tx: IConfirmedTransaction<MultisigAsset>, block: SignedBlockType, sender: any): Promise<void> {
    delete this.unconfirmedSignatures[sender.address];
    await this.library.account.merge(
      sender.address,
      {
        blockId        : block.id,
        multilifetime  : tx.asset.multisignature.lifetime,
        multimin       : tx.asset.multisignature.min,
        multisignatures: tx.asset.multisignature.keysgroup,
        round          : this.modules.rounds.calcRound(block.height),
      },
      emptyCB
    );

    // Generate accounts
    for (const key of tx.asset.multisignature.keysgroup) {
      // index 0 has "+" or "-"
      const realKey = key.substr(1);
      const address = this.library.account.generateAddressByPublicKey(realKey);
      await this.modules.accounts.setAccountAndGet({ address, publicKey: realKey });
    }
  }

  public undo(tx: IConfirmedTransaction<MultisigAsset>, block: SignedBlockType, sender: any): Promise<void> {
    const multiInvert = Diff.reverse(tx.asset.multisignature.keysgroup);

    this.unconfirmedSignatures[sender.address] = true;

    return this.library.account.merge(
      sender.address, {
        blockId        : block.id,
        multilifetime  : -tx.asset.multisignature.lifetime,
        multimin       : -tx.asset.multisignature.min,
        multisignatures: multiInvert,
        round          : this.modules.rounds.calcRound(block.height),
      },
      emptyCB
    );
  }

  public applyUnconfirmed(tx: IBaseTransaction<MultisigAsset>, sender: any): Promise<void> {
    if (this.unconfirmedSignatures[sender.address]) {
      throw new Error('Signature on this account is pending confirmation');
    }
    this.unconfirmedSignatures[sender.address] = true;

    return this.library.account.merge(
      sender.address,
      {
        u_multilifetime  : tx.asset.multisignature.lifetime,
        u_multimin       : tx.asset.multisignature.min,
        u_multisignatures: tx.asset.multisignature.keysgroup,
      },
      emptyCB
    );
  }

  public undoUnconfirmed(tx: IBaseTransaction<MultisigAsset>, sender: any): Promise<void> {
    const multiInvert = Diff.reverse(tx.asset.multisignature.keysgroup);
    delete this.unconfirmedSignatures[sender.address];

    return this.library.account.merge(
      sender.address,
      {
        u_multilifetime  : -tx.asset.multisignature.lifetime,
        u_multimin       : -tx.asset.multisignature.min,
        u_multisignatures: multiInvert,
      },
      emptyCB
    );
  }

  public objectNormalize(tx: IBaseTransaction<MultisigAsset>): IBaseTransaction<MultisigAsset> {
    const report = this.library.schema.validate(tx.asset.multisignature, multiSigSchema);
    if (!report) {
      throw new Error(`Failed to validate multisignature schema: ${this.library.schema.getLastErrors()
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
  public dbSave(tx: IConfirmedTransaction<MultisigAsset> & { senderId: string }): { table: string; fields: string[]; values: any } {
    // tslint:disable object-literal-sort-keys
    return {
      table : this.dbTable,
      fields: this.dbFields,
      values: {
        min          : tx.asset.multisignature.min,
        lifetime     : tx.asset.multisignature.lifetime,
        keysgroup    : tx.asset.multisignature.keysgroup.join(','),
        transactionId: tx.id,
      },
    };
    // tslint:enable object-literal-sort-keys
  }

  public afterSave(tx: IBaseTransaction<MultisigAsset>): Promise<void> {
    this.library.network.io.sockets.emit('multisignatures/change', tx);
    return Promise.resolve();
  }

  /**
   * Checks if the tx is ready to be confirmed.
   * So it checks if the tx has been cosigned by every member if new account or min members.
   * DOES not check the signatures validity but just the number.
   * @param {IBaseTransaction<MultisigAsset>} tx
   * @param sender
   * @returns {boolean}
   */
  public ready(tx: IBaseTransaction<MultisigAsset>, sender: any): boolean {
    if (!Array.isArray(tx.signatures)) {
      return false;
    }
    if (!Array.isArray(sender.multisignatures) || sender.multisignatures.length === 0) {
      return tx.signatures.length === tx.asset.multisignature.keysgroup.length;
    } else {
      return tx.signatures.length >= sender.multimin;
    }
  }
}
