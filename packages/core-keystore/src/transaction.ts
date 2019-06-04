import { ModelSymbols } from '@risevision/core-models';
import { BaseTx } from '@risevision/core-transactions';
import {
  DBCreateOp,
  DBOp,
  IAccountLogic,
  IAccountsModel,
  IAccountsModule,
  IBaseTransaction,
  ISystemModule,
  SignedBlockType,
  Symbols,
} from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import * as isEmpty from 'is-empty';
import * as varuint from 'varuint-bitcoin';
import * as z_schema from 'z-schema';
import { KeystoreConstantsType } from './constants';
import { VerifyKeystoreTx } from './hooks/';
import { KeystoreModel } from './models/';
import { KeystoreTxSymbols } from './symbols';

// tslint:disable-next-line
export type KeyStoreAsset<T = Buffer> = {
  key: string;
  value: T;
};
// tslint:disable-next-line
const assetSchema = require('../schema/asset.json');

@injectable()
export class KeystoreTransaction extends BaseTx<KeyStoreAsset, KeystoreModel> {
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;

  @inject(ModelSymbols.model)
  @named(KeystoreTxSymbols.model)
  private KeyStoreAssetModel: typeof KeystoreModel;

  @inject(Symbols.generic.zschema)
  private zSchema: z_schema;

  @inject(KeystoreTxSymbols.constants)
  private keystoreConstants: KeystoreConstantsType;

  public assetBytes(tx: IBaseTransaction<KeyStoreAsset>): Buffer {
    const keyBuf = Buffer.from(tx.asset.key, 'utf8');
    return Buffer.concat([
      varuint.encode(keyBuf.length),
      keyBuf,
      varuint.encode(tx.asset.value.length),
      tx.asset.value,
    ]);
  }

  public readAssetFromBytes(bytes: Buffer): KeyStoreAsset {
    let offset = 0;
    function decodeItem() {
      const valueLength = varuint.decode(bytes, offset);
      offset += varuint.decode.bytes;
      const toRet = bytes.slice(offset, offset + valueLength);
      offset += valueLength;
      return toRet;
    }

    const key = decodeItem().toString('utf8');
    const value = decodeItem();

    return { key, value };
  }

  public calculateMinFee(
    tx: IBaseTransaction<KeyStoreAsset, bigint>,
    sender: IAccountsModel,
    height: number
  ): bigint {
    const fees = this.systemModule.getFees(height).fees;
    return (
      fees.keystore +
      BigInt(this.assetBytes(tx).length) * fees.keystoreMultiplier
    );
  }

  public async verify(
    tx: IBaseTransaction<KeyStoreAsset, bigint>,
    sender: IAccountsModel
  ): Promise<void> {
    if (tx.recipientId) {
      throw new Error('Recipient not allowed');
    }

    if (tx.amount !== 0n) {
      throw new Error('Invalid transaction amount');
    }

    if (!this.zSchema.validate(tx.asset, assetSchema)) {
      const lastErrorDetail = this.zSchema.getLastError().details[0];
      const errMessage = `${lastErrorDetail.path} ${lastErrorDetail.message}`;
      throw new Error(`Asset Schema is not valid: ${errMessage}`);
    }

    if (isEmpty(tx.asset.value) || tx.asset.value.length === 0) {
      throw new Error('Asset value cannot be empty');
    }
    if (tx.asset.value.length > this.keystoreConstants.maxValueLength) {
      throw new Error('Asset value cannot exceed max length');
    }

    await this.hookSystem.do_action(VerifyKeystoreTx.name, tx, sender);
  }

  public async apply(
    tx: IBaseTransaction<KeyStoreAsset>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    return [];
  }

  // tslint:disable-next-line max-line-length
  public async undo(
    tx: IBaseTransaction<KeyStoreAsset>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>> {
    return [];
  }

  public objectNormalize(
    tx: IBaseTransaction<KeyStoreAsset<string | Buffer>, bigint>
  ): IBaseTransaction<KeyStoreAsset, bigint> {
    if (tx.asset && typeof tx.asset.value === 'string') {
      tx.asset.value = Buffer.from(tx.asset.value, 'hex');
    }
    return tx as IBaseTransaction<KeyStoreAsset>;
  }

  public async attachAssets(
    txs: Array<IBaseTransaction<KeyStoreAsset>>
  ): Promise<void> {
    const r =
      (await this.KeyStoreAssetModel.findAll({
        raw: true,
        where: {
          transactionId: txs.map((t) => t.id),
        },
      })) || [];
    const byId: { [id: string]: IBaseTransaction<KeyStoreAsset> } = {};
    txs.forEach((t) => (byId[t.id] = t));

    for (const m of r) {
      byId[m.transactionId].asset = {
        key: m.key,
        value: m.value,
      };
    }
  }

  /**
   * it'll allow only one "key"+"sender" per set.
   * @param txs
   */
  // tslint:disable-next-line
  public async findConflicts(
    txs: Array<IBaseTransaction<KeyStoreAsset>>
  ): Promise<Array<IBaseTransaction<KeyStoreAsset>>> {
    const conflictingTransactions: Array<IBaseTransaction<KeyStoreAsset>> = [];
    const senders = {};
    for (const tx of txs) {
      const ass = tx.asset;
      if (typeof senders[tx.senderId] === 'undefined') {
        senders[tx.senderId] = {};
      }
      if (typeof senders[tx.senderId][ass.key] !== 'undefined') {
        conflictingTransactions.push(tx);
      } else {
        senders[tx.senderId][ass.key] = tx;
      }
    }

    return conflictingTransactions;
  }

  public dbSave(tx: IBaseTransaction<KeyStoreAsset>) {
    return {
      model: this.KeyStoreAssetModel,
      type: 'create',
      values: {
        key: tx.asset.key,
        transactionId: tx.id,
        value: tx.asset.value,
      },
    } as DBCreateOp<KeystoreModel>;
  }
}
