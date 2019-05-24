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
import { KeystoreModel } from './models/model';
import { KeystoreTxSymbols } from './symbols';
import { VerifyKeystoreTx } from './hooks/actions';

// tslint:disable-next-line
export type KeyStoreAsset<T = Buffer> = {
  key: string;
  value: T;
};

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

  public assetBytes(tx: IBaseTransaction<KeyStoreAsset>): Buffer {
    return Buffer.concat([
      varuint.encode(Buffer.from(tx.asset.key, 'utf8')),
      tx.asset.value,
    ]);
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

    if (!tx.asset) {
      throw new Error('No asset provided');
    }

    if (isEmpty(tx.asset.key)) {
      throw new Error('Asset key cannot be empty');
    }

    if (isEmpty(tx.asset.value) || tx.asset.value.length === 0) {
      throw new Error('Asset key cannot be empty');
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
      tx.asset.value = Buffer.from(tx.asset.value, 'utf8');
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
