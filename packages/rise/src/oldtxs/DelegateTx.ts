import {
  AccountsModelForDPOS,
  DelegatesModel,
  dPoSSymbols,
} from '@risevision/core-consensus-dpos';
import {
  IAccountsModel,
  IAccountsModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  DBCreateOp,
  DBOp,
  IBaseTransaction,
  SignedBlockType,
} from '@risevision/core-types';
import { removeEmptyObjKeys } from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import * as z_schema from 'z-schema';
import { OldBaseTx } from './BaseOldTx';

// tslint:disable-next-line no-var-requires
const delegateAssetSchema = require('../../schema/delegate.asset.json');

// tslint:disable-next-line interface-over-type-literal
export type DelegateAsset = {
  delegate: {
    username: string;
  };
};

@injectable()
export class OldRegDelegateTx extends OldBaseTx<DelegateAsset, DelegatesModel> {
  // Generic
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule<AccountsModelForDPOS>;
  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.delegates)
  private DelegatesModel: typeof DelegatesModel;

  public calculateMinFee(
    tx: IBaseTransaction<DelegateAsset>,
    sender: AccountsModelForDPOS,
    height: number
  ) {
    return this.systemModule.getFees(height).fees.delegate;
  }

  public assetBytes(tx: IBaseTransaction<DelegateAsset>): Buffer {
    return Buffer.from(tx.asset.delegate.username || '', 'utf8');
  }

  public readAsset(
    bytes: Buffer
  ): { consumedBytes: number; asset: DelegateAsset } {
    const username = bytes
      .slice(0, bytes.length - Math.floor(bytes.length / 64) * 64)
      .toString('utf8');
    return {
      asset: {
        delegate: {
          username,
        },
      },
      consumedBytes: 1,
    };
  }

  public async verify(
    tx: IBaseTransaction<DelegateAsset>,
    sender: AccountsModelForDPOS
  ): Promise<void> {
    if (tx.recipientId) {
      throw new Error('Invalid recipient');
    }

    if (tx.amount !== 0n) {
      throw new Error('Invalid transaction amount');
    }

    if (sender.isDelegate) {
      throw new Error('Account is already a delegate');
    }

    if (!tx.asset || !tx.asset.delegate) {
      throw new Error('Invalid transaction asset');
    }

    if (!tx.asset.delegate.username) {
      throw new Error('Username is undefined');
    }

    if (
      tx.asset.delegate.username !== tx.asset.delegate.username.toLowerCase()
    ) {
      throw new Error('Username must be lowercase');
    }

    const username = String(tx.asset.delegate.username)
      .toLowerCase()
      .trim();

    if (username === '') {
      throw new Error('Empty username');
    }

    if (username.length > 20) {
      throw new Error('Username is too long. Maximum is 20 characters');
    }

    if (
      this.schema.validate(tx.asset.delegate.username, {
        format: 'address',
      })
    ) {
      throw new Error('Username can not be a potential address');
    }

    if (
      !this.schema.validate(tx.asset.delegate.username, { format: 'username' })
    ) {
      throw new Error(
        'Username can only contain alphanumeric characters with the exception of !@$&_.'
      );
    }

    if (!this.schema.validate(tx.senderPubData, { format: 'publicKeyBuf' })) {
      throw new Error(
        'With this transaction type you need to use plain pubKey buffer'
      );
    }

    const account = await this.accountsModule.getAccount({ username });
    if (account) {
      throw new Error(`Username already exists: ${username}`);
    }
  }

  // tslint:disable-next-line max-line-length
  public async apply(
    tx: IBaseTransaction<DelegateAsset>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate: 1 as any,
      u_isDelegate: 1 as any,
      vote: 0n,
      // tslint:disable-next-line
      u_username: tx.asset.delegate.username,
      username: tx.asset.delegate.username,
      forgingPK: tx.senderPubData,
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
    tx: IBaseTransaction<DelegateAsset>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate: 0 as 0 | 1,
      u_isDelegate: 1 as 0 | 1,
      vote: 0n,
      // tslint:disable-next-line
      username: null,
      forgingPK: null,
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
    tx: IBaseTransaction<DelegateAsset>,
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
    tx: IBaseTransaction<DelegateAsset>,
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
    tx: IBaseTransaction<DelegateAsset, bigint>
  ): IBaseTransaction<DelegateAsset, bigint> {
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

  // tslint:disable-next-line max-line-length
  public dbSave(
    tx: IBaseTransaction<DelegateAsset>
  ): DBCreateOp<DelegatesModel> {
    return {
      model: this.DelegatesModel,
      type: 'create',
      values: {
        forgingPK: tx.senderPubData,
        transactionId: tx.id,
        username: tx.asset.delegate.username,
      },
    };
  }

  public async attachAssets(txs: Array<IBaseTransaction<DelegateAsset>>) {
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
    return size;
  }
}
