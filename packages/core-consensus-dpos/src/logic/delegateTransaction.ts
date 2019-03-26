import { ModelSymbols } from '@risevision/core-models';
import {
  BaseTx,
  TransactionsModel,
  TXSymbols,
} from '@risevision/core-transactions';
import {
  DBCreateOp,
  DBOp,
  IAccountsModel,
  IAccountsModule,
  IBaseTransaction,
  ISystemModule,
  SignedBlockType,
  Symbols,
} from '@risevision/core-types';
import { removeEmptyObjKeys } from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import * as sequelize from 'sequelize';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { As } from 'type-tagger';
import * as z_schema from 'z-schema';
import { dPoSSymbols } from '../helpers/';
import { AccountsModelForDPOS, DelegatesModel } from '../models/';

// tslint:disable-next-line no-var-requires
const delegateAssetSchema = require('../../schema/asset.json');

// tslint:disable-next-line interface-over-type-literal
export type DelegateAsset = {
  delegate: {
    username: string;
    forgingPK: Buffer & As<'publicKey'>;
  };
};

@injectable()
export class RegisterDelegateTransaction extends BaseTx<
  DelegateAsset,
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
  @inject(ModelSymbols.model)
  @named(TXSymbols.models.model)
  private TransactionsModel: typeof TransactionsModel;

  public calculateMinFee(
    tx: IBaseTransaction<DelegateAsset>,
    sender: AccountsModelForDPOS,
    height: number
  ) {
    return this.systemModule.getFees(height).fees.delegate;
  }

  public fromBytes(buff: Buffer): IBaseTransaction<DelegateAsset, bigint> {
    const tx = super.fromBytes(buff);
    if (tx.recipientId !== '0R') {
      throw new Error('Invalid recipient');
    }
    delete tx.recipientId;
    return tx;
  }

  public assetBytes(tx: IBaseTransaction<DelegateAsset>): Buffer {
    return Buffer.concat([
      tx.asset.delegate.forgingPK,
      Buffer.from(tx.asset.delegate.username || '', 'utf8'),
    ]);
  }

  public readAssetFromBytes(bytes: Buffer): DelegateAsset {
    const forgingPK = bytes.slice(0, 32) as Buffer & As<'publicKey'>;
    const username =
      bytes.length === 32 ? null : bytes.slice(32).toString('utf8');

    return {
      delegate: {
        forgingPK,
        username,
      },
    };
  }

  // tslint:disable-next-line cognitive-complexity
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

    if (!tx.asset || !tx.asset.delegate) {
      throw new Error('Invalid transaction asset');
    }

    const isRegistration = this.isTxFirstRegistration(tx);
    if (!sender.isDelegate && !isRegistration) {
      throw new Error('Account needs to be a delegate to change public key');
    }

    if (sender.isDelegate && isRegistration) {
      throw new Error('Account is already a delegate');
    }

    if (isRegistration) {
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
        !this.schema.validate(tx.asset.delegate.username, {
          format: 'username',
        })
      ) {
        throw new Error(
          'Username can only contain alphanumeric characters with the exception of !@$&_.'
        );
      }

      const account = await this.accountsModule.getAccount({ username });
      if (account) {
        throw new Error(`Username already exists: ${username}`);
      }
    } else {
      // If not registration then tx should not specify the username.
      if (tx.asset.delegate.username) {
        throw new Error('Username cannot change');
      }
    }

    if (!tx.asset.delegate.forgingPK) {
      throw new Error('ForgingPK is undefined');
    }

    if (tx.asset.delegate.forgingPK.length !== 32) {
      throw new Error('ForgingPK is not 32bytes long');
    }

    const pubKeyConflict = await this.accountsModule.getAccount({
      forgingPK: tx.asset.delegate.forgingPK,
    });
    if (pubKeyConflict) {
      throw new Error('Forging Public Key already exists');
    }
  }

  public async findConflicts(
    txs: Array<IBaseTransaction<DelegateAsset>>
  ): Promise<Array<IBaseTransaction<DelegateAsset>>> {
    const conflictingTxs: Array<IBaseTransaction<DelegateAsset>> = [];
    const allPublicKeys: string[] = [];
    const allUsernames: string[] = [];
    for (const tx of txs) {
      if (this.isTxFirstRegistration(tx)) {
        if (allUsernames.includes(tx.asset.delegate.username)) {
          conflictingTxs.push(tx);
        } else {
          allUsernames.push(tx.asset.delegate.username);
        }
      }

      if (allPublicKeys.includes(tx.asset.delegate.forgingPK.toString('hex'))) {
        conflictingTxs.push(tx);
      } else {
        allPublicKeys.push(tx.asset.delegate.forgingPK.toString('hex'));
      }
    }

    return conflictingTxs;
  }

  // tslint:disable-next-line max-line-length
  public async apply(
    tx: IBaseTransaction<DelegateAsset>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    let data: Partial<AccountsModelForDPOS>;
    if (this.isTxFirstRegistration(tx)) {
      data = {
        isDelegate: 1 as 1,
        u_isDelegate: 1 as 1,
        vote: 0n,
        // tslint:disable-next-line
        u_username: tx.asset.delegate.username,
        username: tx.asset.delegate.username,
        forgingPK: tx.asset.delegate.forgingPK,
      };
    } else {
      data = {
        forgingPK: tx.asset.delegate.forgingPK,
      };
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

  public async undo(
    tx: IBaseTransaction<DelegateAsset>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    if (this.isTxFirstRegistration(tx)) {
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
    } else {
      const res = await this.DelegatesModel.findOne({
        include: [
          {
            model: this.TransactionsModel,
            required: true,
            where: {
              id: { $not: tx.id },
              senderId: sender.address,
            },
          },
        ],
        order: [sequelize.literal('"tx"."height" DESC')],
      });
      sender.applyValues({ forgingPK: res.forgingPK });
      return [
        {
          model: this.AccountsModel,
          options: {
            where: { address: sender.address },
          },
          type: 'update',
          values: {
            forgingPK: res.forgingPK,
          },
        },
      ];
    }
  }

  /**
   * Stores in accounts that sender is now an unconfirmed delegate
   */
  public async applyUnconfirmed(
    tx: IBaseTransaction<DelegateAsset>,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    if (this.isTxFirstRegistration(tx)) {
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
    } else {
      return [];
    }
  }

  public async undoUnconfirmed(
    tx: IBaseTransaction<DelegateAsset>,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    if (this.isTxFirstRegistration(tx)) {
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
    } else {
      return [];
    }
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
    const values: FilteredModelAttributes<DelegatesModel> = {
      forgingPK: tx.asset.delegate.forgingPK,
      transactionId: tx.id,
    };
    if (this.isTxFirstRegistration(tx)) {
      values.username = tx.asset.delegate.username;
    }
    return {
      model: this.DelegatesModel,
      type: 'create',
      values,
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
          forgingPK: info.forgingPK,
          username: info.username,
        },
      };
    });
  }

  public getMaxBytesSize(): number {
    let size = super.getMaxBytesSize();
    size += 20; // username
    size += 32; // publicKey
    return size;
  }

  private isTxFirstRegistration(tx: IBaseTransaction<DelegateAsset>) {
    return tx.asset && tx.asset.delegate && tx.asset.delegate.username;
  }
}
