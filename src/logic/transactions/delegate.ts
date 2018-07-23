import { inject, injectable } from 'inversify';
import * as z_schema from 'z-schema';
import { removeEmptyObjKeys, TransactionType } from '../../helpers/';
import { IAccountsModule, ISystemModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { AccountsModel, DelegatesModel } from '../../models/';
import delegateSchema from '../../schema/logic/transactions/delegate';
import { DBCreateOp, DBOp } from '../../types/genericTypes';
import { SignedBlockType } from '../block';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';

// tslint:disable-next-line interface-over-type-literal
export type DelegateAsset = {
  delegate: {
    username: string;
  }
};

@injectable()
export class RegisterDelegateTransaction extends BaseTransactionType<DelegateAsset, DelegatesModel> {

  // Generic
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.delegates)
  private DelegatesModel: typeof DelegatesModel;

  constructor() {
    super(TransactionType.DELEGATE);
  }

  /**
   * Returns fees from a given height
   */
  public calculateFee(tx: IBaseTransaction<DelegateAsset>, sender: AccountsModel, height: number): number {
    return this.systemModule.getFees(height).fees.delegate;
  }

  /**
   * Calculates bytes from delegate asset
   */
  public getBytes(tx: IBaseTransaction<DelegateAsset>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    if (!tx.asset.delegate.username) {
      return null;
    }
    return Buffer.from(tx.asset.delegate.username, 'utf8');
  }

  /**
   * Verify a transaction
   */
  public async verify(tx: IBaseTransaction<DelegateAsset>, sender: AccountsModel): Promise<void> {
    if (tx.recipientId) {
      throw new Error('Invalid recipient');
    }

    if (tx.amount !== 0) {
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

    if (tx.asset.delegate.username !== tx.asset.delegate.username.toLowerCase()) {
      throw new Error('Username must be lowercase');
    }

    const username = String(tx.asset.delegate.username).toLowerCase().trim();

    if (username === '') {
      throw new Error('Empty username');
    }

    if (username.length > 20) {
      throw new Error('Username is too long. Maximum is 20 characters');
    }

    if (this.schema.validate(tx.asset.delegate.username.toUpperCase(), { format: 'address' })) {
      throw new Error('Username can not be a potential address');
    }

    if (!this.schema.validate(tx.asset.delegate.username, { format: 'username' })) {
      throw new Error('Username can only contain alphanumeric characters with the exception of !@$&_.');
    }

    const account = await this.accountsModule.getAccount({ username });
    if (account) {
      throw new Error(`Username already exists: ${username}`);
    }
  }

  /**
   * Stores delegate into account
   */
  // tslint:disable-next-line max-line-length
  public async apply(tx: IConfirmedTransaction<DelegateAsset>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate  : 1 as any,
      u_isDelegate: 1 as any,
      vote        : 0,
      u_username  : tx.asset.delegate.username,
      username    : tx.asset.delegate.username,
    };
    // TODO: Else? tx is not a valid tx. so why bothering doing an if ^^ ?
    if (sender.isDelegate === 1) {
      throw new Error('Account is already a delegate');
    }
    sender.applyValues(data);
    return [{
      model  : this.AccountsModel,
      options: {
        where: { address: sender.address },
      },
      type   : 'update',
      values : data,
    }];
  }

  /**
   * Restore delegate asset to a previous state
   */
  // tslint:disable-next-line max-line-length
  public async undo(tx: IConfirmedTransaction<DelegateAsset>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate  : 0 as 0 | 1,
      u_isDelegate: 1 as 0 | 1,
      vote        : 0,
      username    : null,
      u_username  : tx.asset.delegate.username,
    };
    sender.applyValues(data);
    return [{
      model  : this.AccountsModel,
      options: {
        where: { address: sender.address },
      },
      type   : 'update',
      values : data,
    }];
  }

  /**
   * Stores in accounts that sender is now an unconfirmed delegate
   */
  public async applyUnconfirmed(tx: IBaseTransaction<DelegateAsset>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate  : 0 as 0 | 1,
      u_isDelegate: 1 as 0 | 1,
      username    : null,
      u_username  : tx.asset.delegate.username,
    };
    if (sender.u_isDelegate === 1) {
      throw new Error('Account is already trying to be a delegate');
    }
    sender.applyValues(data);
    return [{
      model  : this.AccountsModel,
      options: {
        where: { address: sender.address },
      },
      type   : 'update',
      values : data,
    }];
  }

  /**
   * Restores unconfirmed asset asset to a previous state
   */
  public async undoUnconfirmed(tx: IBaseTransaction<DelegateAsset>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    const data = {
      isDelegate  : 0 as 0 | 1,
      u_isDelegate: 0 as 0 | 1,
      username    : null,
      u_username  : null,
    };
    sender.applyValues(data);
    return [{
      model  : this.AccountsModel,
      options: {
        where: { address: sender.address },
      },
      type   : 'update',
      values : data,
    }];
  }

  /**
   * Validates delegate asset using a schema
   */
  public objectNormalize(tx: IBaseTransaction<DelegateAsset>): IBaseTransaction<DelegateAsset> {
    removeEmptyObjKeys(tx.asset.delegate);

    const report = this.schema.validate(tx.asset.delegate, delegateSchema);
    if (!report) {
      throw new Error(`Failed to validate delegate schema: ${this.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
    }

    return tx;
  }

  /**
   * Returns delegate from a raw object
   */
  public dbRead(raw: any): DelegateAsset {
    if (!raw.d_username) {
      return null;
    } else {
      // tslint:disable object-literal-sort-keys
      return {
        delegate: {
          username: raw.d_username
        },
      };
      // tslint:enable object-literal-sort-keys
    }
  }

  /**
   * create a new delegate into database
   */
  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<DelegateAsset> & { senderId: string }): DBCreateOp<DelegatesModel> {
    return {
      model : this.DelegatesModel,
      type  : 'create',
      values: {
        transactionId: tx.id,
        username     : tx.asset.delegate.username,
      },
    };
  }

  /**
   * Fetchs Assets From Datastore and returns the same txs with the asset field properly populated.
   */
  public async attachAssets(txs: Array<IConfirmedTransaction<DelegateAsset>>) {
    const res = await this.DelegatesModel
      .findAll({
        where: { transactionId: txs.map((tx) => tx.id) },
      });

    const indexes = {};
    res.forEach((tx, idx) => indexes[tx.transactionId] = idx);

    txs.forEach((tx) => {
      if (typeof(indexes[tx.id]) === 'undefined') {
        throw new Error(`Couldn't restore asset for Delegate tx: ${tx.id}`);
      }
      const info = res[indexes[tx.id]];
      tx.asset   = {
        delegate: {
          username: info.username,
        },
      };
    });
  }
}
