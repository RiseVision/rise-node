import {
  IAccountsModel,
  IAccountsModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { BaseTx } from '@risevision/core-transactions';
import {
  DBCreateOp,
  DBOp,
  IBaseTransaction,
  SignedBlockType,
  TransactionType,
} from '@risevision/core-types';
import { removeEmptyObjKeys } from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import * as z_schema from 'z-schema';
import { dPoSSymbols } from '../helpers/';
import { AccountsModelForDPOS, DelegatesModel } from '../models/';

// tslint:disable-next-line no-var-requires
const delegateAssetSchema = require('../../schema/asset.json');

// tslint:disable-next-line interface-over-type-literal
export type NewForgingPKAsset = {
  newForgingPK: Buffer;
};

@injectable()
export class ChangeDelegatePubKeyTransaction extends BaseTx<
  NewForgingPKAsset,
  DelegatesModel
> {
  // Generic
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule<AccountsModelForDPOS>;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.delegates)
  private DelegatesModel: typeof DelegatesModel;

  constructor() {
    super(5);
  }

  public calculateFee(
    tx: IBaseTransaction<NewForgingPKAsset>,
    sender: AccountsModelForDPOS,
    height: number
  ) {
    return this.systemModule.getFees(height).fees.delegate;
  }

  public assetBytes(tx: IBaseTransaction<NewForgingPKAsset>): Buffer {
    return tx.asset.newForgingPK;
  }

  public readAssetFromBytes(bytes: Buffer): NewForgingPKAsset {
    return {
      newForgingPK: bytes.slice(0, 32),
    };
  }

  public async verify(
    tx: IBaseTransaction<NewForgingPKAsset>,
    sender: AccountsModelForDPOS
  ): Promise<void> {
    if (tx.recipientId) {
      throw new Error('Invalid recipient');
    }

    if (tx.amount !== 0n) {
      throw new Error('Invalid transaction amount');
    }

    if (!sender.isDelegate) {
      throw new Error('Account is NOT a delegate');
    }

    if (!tx.asset.newForgingPK) {
      throw new Error('ForgingPK is undefined');
    }

    if (tx.asset.newForgingPK.length !== 32) {
      throw new Error('ForgingPK is not 32bytes long');
    }

    const account = await this.accountsModule.getAccount({
      forgingPK: tx.asset.newForgingPK,
    });

    if (account) {
      throw new Error(
        `An account with such forging public key already exists: ${
          account.username
        }`
      );
    }
  }

  // tslint:disable-next-line max-line-length
  public async apply(
    tx: IBaseTransaction<NewForgingPKAsset>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    const data = {
      forgingPK: tx.asset.newForgingPK,
    };
    sender.applyValues(data);
    return [
      {
        model: this.AccountsModel,
        options: {
          where: { address: sender.address },
        },
        type: 'update',
        values: data,
      },
    ];
  }

  // tslint:disable-next-line max-line-length
  public async undo(
    tx: IBaseTransaction<NewForgingPKAsset>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate: 0 as 0 | 1,
      u_isDelegate: 1 as 0 | 1,
      vote: 0n,
      // tslint:disable-next-line
      username: null,
      u_username: tx.asset.delegate.username,
    };
    sender.applyValues(data);
    return [
      {
        model: this.AccountsModel,
        options: {
          where: { address: sender.address },
        },
        type: 'update',
        values: data,
      },
    ];
  }

  /**
   * Stores in accounts that sender is now an unconfirmed delegate
   */
  public async applyUnconfirmed(
    tx: IBaseTransaction<NewForgingPKAsset>,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate: 0 as 0 | 1,
      u_isDelegate: 1 as 0 | 1,
      username: null,
      // tslint:disable-next-line
      u_username: tx.asset.delegate.username,
    };
    if (sender.u_isDelegate === 1) {
      throw new Error('Account is already trying to be a delegate');
    }
    sender.applyValues(data);
    return [
      {
        model: this.AccountsModel,
        options: {
          where: { address: sender.address },
        },
        type: 'update',
        values: data,
      },
    ];
  }

  public async undoUnconfirmed(
    tx: IBaseTransaction<NewForgingPKAsset>,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate: 0 as 0 | 1,
      u_isDelegate: 0 as 0 | 1,
      username: null,
      // tslint:disable-next-line
      u_username: null,
    };
    sender.applyValues(data);
    return [
      {
        model: this.AccountsModel,
        options: {
          where: { address: sender.address },
        },
        type: 'update',
        values: data,
      },
    ];
  }

  public objectNormalize(
    tx: IBaseTransaction<NewForgingPKAsset, bigint>
  ): IBaseTransaction<NewForgingPKAsset, bigint> {
    removeEmptyObjKeys(tx.asset.delegate);

    const report = this.schema.validate(tx.asset.delegate, delegateAssetSchema);
    if (!report) {
      throw new Error(
        `Failed to validate delegate schema: ${this.schema
          .getLastErrors()
          .map((err) => err.message)
          .join(', ')}`
      );
    }

    return tx;
  }

  public dbRead(raw: any): NewForgingPKAsset {
    if (!raw.d_username) {
      return null;
    } else {
      // tslint:disable object-literal-sort-keys
      return {
        delegate: {
          username: raw.d_username,
        },
      };
      // tslint:enable object-literal-sort-keys
    }
  }

  // tslint:disable-next-line max-line-length
  public dbSave(
    tx: IBaseTransaction<NewForgingPKAsset>
  ): DBCreateOp<DelegatesModel> {
    return {
      model: this.DelegatesModel,
      type: 'create',
      values: {
        transactionId: tx.id,
        username: tx.asset.delegate.username,
      },
    };
  }

  public async attachAssets(txs: Array<IBaseTransaction<NewForgingPKAsset>>) {
    const res = await this.DelegatesModel.findAll({
      where: { transactionId: txs.map((tx) => tx.id) },
    });

    const indexes = {};
    res.forEach((tx, idx) => (indexes[tx.transactionId] = idx));

    txs.forEach((tx) => {
      if (typeof indexes[tx.id] === 'undefined') {
        throw new Error(`Couldn't restore asset for Delegate tx: ${tx.id}`);
      }
      const info = res[indexes[tx.id]];
      tx.asset = {
        delegate: {
          username: info.username,
        },
      };
    });
  }

  public getMaxBytesSize(): number {
    let size = super.getMaxBytesSize();
    size += 20; // username
    size += 32; // publicKey
    size += 8; // address
    return size;
  }
}
