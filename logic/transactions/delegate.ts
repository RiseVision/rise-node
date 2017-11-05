import {removeEmptyObjKeys} from '../../helpers/genericUtils';
import {cbToPromise} from '../../helpers/promiseToCback';
import {TransactionType} from '../../helpers/transactionTypes';
import {ILogger} from '../../logger';
import delegateSchema from '../../schema/logic/transactions/delegate';
import {SignedBlockType} from '../block';
import {BaseTransactionType, IBaseTransaction, IConfirmedTransaction} from './baseTransactionType';

// tslint:disable-next-line interface-over-type-literal
export type DelegateAsset = {
  delegate: {
    username: string;
    publicKey: string;
    address?: string;
  }
};

export class RegisterDelegateTransaction extends BaseTransactionType<DelegateAsset> {

  public modules: { accounts: any, system: any };
  private unconfirmedNames: { [name: string]: true };
  private unconfirmedLinks: { [link: string]: true };
  private dbTable  = 'delegates';
  private dbFields = [
    'username',
    'transactionId',
  ];

  constructor(public library: { db: any, logger: ILogger, schema: any, network: any }) {
    super(TransactionType.DAPP);
  }

  public bind(accounts: any, system: any) {
    this.modules = { accounts, system };
  }

  public calculateFee(tx: IBaseTransaction<DelegateAsset>, sender: any, height: number): number {
    return this.modules.system.getFees(height).fees.delegate;
  }

  public getBytes(tx: IBaseTransaction<DelegateAsset>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    if (!tx.asset.delegate.username) {
      return null;
    }
    return Buffer.from(tx.asset.delegate.username, 'utf8');
  }

  public async verify(tx: IBaseTransaction<DelegateAsset>, sender: any): Promise<void> {
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

    if (this.library.schema.validate(tx.asset.delegate.username, { format: 'address' })) {
      throw new Error('Username can not be a potential address');
    }

    if (!this.library.schema.validate(tx.asset.delegate.username, { format: 'username' })) {
      throw new Error('Username can only contain alphanumeric characters with the exception of !@$&_.');
    }

    return cbToPromise((cb) => this.modules.accounts.getAccount({ username }, cb))
      .then((account) => {
        if (account) {
          throw new Error('Usernale already exists');
        }
      });
  }

  public apply(tx: IConfirmedTransaction<DelegateAsset>, block: SignedBlockType, sender: any): Promise<void> {
    const data: any = {
      address     : sender.address,
      isDelegate  : 1,
      u_isDelegate: 0,
      vote        : 0,
    };
    if (tx.asset.delegate.username) {
      data.username   = null;
      data.u_username = tx.asset.delegate.username;
    }

    return cbToPromise((cb) => this.modules.accounts.setAccountAndGet(data, cb));
  }

  public undo(tx: IConfirmedTransaction<DelegateAsset>, block: SignedBlockType, sender: any): Promise<void> {
    const data: any = {
      address     : sender.address,
      isDelegate  : 0,
      u_isDelegate: 1,
      vote        : 0,
    };
    if (!sender.nameexist && tx.asset.delegate.username) {
      data.username   = null;
      data.u_username = tx.asset.delegate.username;
    }

    return cbToPromise((cb) => this.modules.accounts.setAccountAndGet(data, cb));
  }

  /**
   * Stores in accounts that sender is now an unconfirmed delegate
   */
  public applyUnconfirmed(tx: IBaseTransaction<DelegateAsset>, sender: any): Promise<void> {
    const data: any = {
      address     : sender.address,
      isDelegate  : 0,
      u_isDelegate: 1,
    };
    if (tx.asset.delegate.username) {
      data.username   = null;
      data.u_username = tx.asset.delegate.username;
    }

    return cbToPromise((cb) => this.modules.accounts.setAccountAndGet(data, cb));
  }

  public undoUnconfirmed(tx: IBaseTransaction<DelegateAsset>, sender: any): Promise<void> {
    const data: any = {
      address     : sender.address,
      isDelegate  : 0,
      u_isDelegate: 0,
    };
    if (tx.asset.delegate.username) {
      data.username   = null;
      data.u_username = null;
    }

    return cbToPromise((cb) => this.modules.accounts.setAccountAndGet(data, cb));
  }

  public objectNormalize(tx: IBaseTransaction<DelegateAsset>): IBaseTransaction<DelegateAsset> {
    removeEmptyObjKeys(tx.asset.delegate);

    const report = this.library.schema.validate(tx.asset.delegate, delegateSchema);
    if (!report) {
      throw new Error(`Failed to validate delegate schema: ${this.library.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
    }

    return tx;
  }

  public dbRead(raw: any): DelegateAsset {
    if (!raw.d_username) {
      return null;
    } else {
      // tslint:disable object-literal-sort-keys
      return {
        delegate: {
          username : raw.d_username,
          publicKey: raw.t_senderPublicKey,
          address  : raw.t_senderId,
        },
      };
      // tslint:enable object-literal-sort-keys
    }
  }

  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<DelegateAsset> & { senderId: string }): { table: string; fields: string[]; values: any } {
    // tslint:disable object-literal-sort-keys
    return {
      table : this.dbTable,
      fields: this.dbFields,
      values: {
        username     : tx.asset.delegate.username,
        transactionId: tx.id,
      },
    };
    // tslint:enable object-literal-sort-keys
  }

}
