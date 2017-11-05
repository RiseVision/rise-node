import * as ByteBuffer from 'bytebuffer';
import * as validUrl from 'valid-url';
import {DappCategory} from '../../helpers/dappCategories';
import {removeEmptyObjKeys} from '../../helpers/genericUtils';
import {TransactionType} from '../../helpers/transactionTypes';
import {ILogger} from '../../logger';
import dappSchema from '../../schema/logic/transactions/dapp';
import dappSql from '../../sql/logic/transactions/dapps';
import {BaseTransactionType, IBaseTransaction, IConfirmedTransaction} from './baseTransactionType';

// tslint:disable-next-line interface-over-type-literal
export type DappAsset = {
  dapp: {
    category: DappCategory;
    name: string;
    description: string;
    tags: string;
    type: number;
    link: string;
    icon: string;
  }
};

export class DappTransaction extends BaseTransactionType<DappAsset> {

  public modules: { system: any };
  private unconfirmedNames: { [name: string]: true };
  private unconfirmedLinks: { [link: string]: true };
  private dbTable  = 'dapps';
  private dbFields = [
    'type',
    'name',
    'description',
    'tags',
    'link',
    'category',
    'icon',
    'transactionId',
  ];

  constructor(public library: { db: any, logger: ILogger, schema: any, network: any }) {
    super(TransactionType.DAPP);
  }

  public bind(system: any) {
    this.modules = { system };
  }

  public calculateFee(tx: IBaseTransaction<DappAsset>, sender: any, height: number): number {
    return this.modules.system.getFees(height).fees.dapp;
  }

  public getBytes(tx: IBaseTransaction<DappAsset>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    let buffer: Buffer = Buffer.from(tx.asset.dapp.name, 'utf8');

    if (tx.asset.dapp.description) {
      buffer = Buffer.concat([buffer, Buffer.from(tx.asset.dapp.description, 'utf8')]);
    }

    if (tx.asset.dapp.tags) {
      buffer = Buffer.concat([buffer, Buffer.from(tx.asset.dapp.tags, 'utf8')]);
    }

    if (tx.asset.dapp.link) {
      buffer = Buffer.concat([buffer, Buffer.from(tx.asset.dapp.link, 'utf8')]);
    }

    if (tx.asset.dapp.icon) {
      buffer = Buffer.concat([buffer, Buffer.from(tx.asset.dapp.icon, 'utf8')]);
    }

    const tmpBB = new ByteBuffer(4 + 4, true);
    tmpBB.writeInt(tx.asset.dapp.type);
    tmpBB.writeInt(tx.asset.dapp.category);
    tmpBB.flip();

    return Buffer.concat([buffer, tmpBB as any]);
  }

  public async verify(tx: IBaseTransaction<DappAsset>, sender: any): Promise<void> {
    if (tx.recipientId) {
      throw new Error('Invalid recipient');
    }

    if (tx.amount !== 0) {
      throw new Error('Invalid transaction amount');
    }

    if (!tx.asset || !tx.asset.dapp) {
      throw new Error('Invalid transaction asset');
    }

    if (tx.asset.dapp.category !== 0 && !tx.asset.dapp.category) {
      throw new Error('Invalid application category');
    }

    if (typeof(DappCategory[tx.asset.dapp.category]) === 'undefined') {
      throw new Error('Application category not found');
    }

    if (tx.asset.dapp.icon) {
      if (!validUrl.isUri(tx.asset.dapp.icon)) {
        throw new Error('Invalid application icon link');
      }
      const iconURL = tx.asset.dapp.icon;
      if (!(iconURL.endsWith('.png') || iconURL.endsWith('.jpg') || iconURL.endsWith('.jpeg'))) {
        throw new Error('Invalid application icon file type');
      }
    }

    if (tx.asset.dapp.type > 1 || tx.asset.dapp.type < 0) {
      throw new Error('Invalid application type');
    }

    if (!validUrl.isUri(tx.asset.dapp.link)) {
      throw new Error('Invalid application link');
    }

    if (!tx.asset.dapp.link.endsWith('.zip')) {
      throw new Error('Invalid application file type');
    }

    if (!tx.asset.dapp.name || tx.asset.dapp.name.trim().length === 0) {
      throw new Error('Application name must not be blank or contain leading or trailing space');
    }

    if (tx.asset.dapp.name.trim() !== tx.asset.dapp.name) {
      throw new Error('Application name must not contain leading or trailing space');
    }

    if (tx.asset.dapp.name.length > 32) {
      throw new Error('Application name is too long. Maximum is 32 characters');
    }

    if (tx.asset.dapp.description && tx.asset.dapp.description.length > 160) {
      throw new Error('Application description is too long. Maximum is 160 characters');
    }

    if (tx.asset.dapp.tags && tx.asset.dapp.tags.length > 160) {
      throw new Error('Application tags is too long. Maximum is 160 characters');
    }

    // Check for duplicated tags
    if (tx.asset.dapp.tags) {
      const splittedTags = tx.asset.dapp.tags.split(',')
        .map((t) => t.trim());

      const duplicatedTags = splittedTags.filter((tag, idx, arr) => arr.indexOf(tag) !== idx);

      if (duplicatedTags.length > 0) {
        throw new Error(`Encountered duplicated tags: ${duplicatedTags.join(', ')} in application`);
      }
    }

    return this.library.db.query(dappSql.getExisting, {
      link         : tx.asset.dapp.link || null,
      name         : tx.asset.dapp.name,
      transactionId: tx.id,
    }).then((rows) => {
      const [dapp] = rows;
      if (dapp) {
        if (dapp.name === tx.asset.dapp.name) {
          throw new Error('Application name already exists');
        } else if (dapp.link === tx.asset.dapp.link) {
          throw new Error('Application link already exists');
        } else {
          throw new Error('Application already exists');
        }
      }
    });
  }

  public applyUnconfirmed(tx: IBaseTransaction<DappAsset>, sender: any): Promise<void> {
    if (this.unconfirmedNames[tx.asset.dapp.name]) {
      throw new Error('Application name already exists');
    }

    if (tx.asset.dapp.link) {
      if (this.unconfirmedLinks[tx.asset.dapp.link]) {
        throw new Error('Application link already exists');
      }
      this.unconfirmedLinks[tx.asset.dapp.link] = true;
    }
    this.unconfirmedNames[tx.asset.dapp.name] = true;
    return Promise.resolve();
  }

  public undoUnconfirmed(tx: IBaseTransaction<DappAsset>, sender: any): Promise<void> {
    delete this.unconfirmedNames[tx.asset.dapp.name];
    delete this.unconfirmedLinks[tx.asset.dapp.name];
    return Promise.resolve();
  }

  public objectNormalize(tx: IBaseTransaction<DappAsset>): IBaseTransaction<DappAsset> {
    removeEmptyObjKeys(tx.asset.dapp);

    const report = this.library.schema.validate(tx.asset.dapp, dappSchema);
    if (!report) {
      throw new Error(`Failed to validate dapp schema: ${this.library.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
    }

    return tx;
  }

  public dbRead(raw: any): DappAsset {
    if (!raw.dapp_name) {
      return null;
    } else {
      // tslint:disable object-literal-sort-keys
      return {
        dapp: {
          name       : raw.dapp_name,
          description: raw.dapp_description,
          tags       : raw.dapp_tags,
          type       : raw.dapp_type,
          link       : raw.dapp_link,
          category   : raw.dapp_category,
          icon       : raw.dapp_icon,
        },
      };
      // tslint:enable object-literal-sort-keys
    }
  }

  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<DappAsset> & { senderId: string }): { table: string; fields: string[]; values: any } {
    // tslint:disable object-literal-sort-keys
    return {
      table : this.dbTable,
      fields: this.dbFields,
      values: {
        type         : tx.asset.dapp.type,
        name         : tx.asset.dapp.name,
        description  : tx.asset.dapp.description || null,
        tags         : tx.asset.dapp.tags || null,
        link         : tx.asset.dapp.link || null,
        icon         : tx.asset.dapp.icon || null,
        category     : tx.asset.dapp.category || null,
        transactionId: tx.id,
      },
    };
    // tslint:enable object-literal-sort-keys
  }

  public afterSave(tx: IBaseTransaction<DappAsset>): Promise<void> {
    this.library.network.io.sockets.emit('dapps/change', {});
    return Promise.resolve();
  }

}
