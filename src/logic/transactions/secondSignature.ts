import { ILogger, TransactionType } from '../../helpers/';
import { AccountsModule, SystemModule } from '../../modules/';
import secondSignatureSchema from '../../schema/logic/transactions/secondSignature';
import { SignedBlockType } from '../block';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';
// tslint:disable-next-line interface-over-type-literal
export type SecondSignatureAsset = {
  signature: {
    publicKey: string;
  }
};

export class SecondSignatureTransaction extends BaseTransactionType<SecondSignatureAsset> {

  public modules: { accounts: AccountsModule, system: SystemModule };
  private dbTable  = 'signatures';
  private dbFields = [
    'publicKey',
    'transactionId',
  ];

  constructor(public library: { logger: ILogger, schema: any }) {
    super(TransactionType.SIGNATURE);
  }

  public bind(accounts: any, system: any) {
    this.modules = { accounts, system };
  }

  public calculateFee(tx: IBaseTransaction<SecondSignatureAsset>, sender: any, height: number): number {
    return this.modules.system.getFees(height).fees.secondsignature;
  }

  public getBytes(tx: IBaseTransaction<SecondSignatureAsset>, skipSignature: boolean,
                  skipSecondSignature: boolean): Buffer {
    return Buffer.from(tx.asset.signature.publicKey, 'hex');
  }

  public async verify(tx: IBaseTransaction<SecondSignatureAsset>, sender: any): Promise<void> {
    if (!tx.asset || !tx.asset.signature) {
      throw new Error('Invalid transaction asset');
    }

    if (tx.recipientId) {
      throw new Error('Invalid recipient');
    }

    if (tx.amount !== 0) {
      throw new Error('Invalid transaction amount');
    }

    if (!tx.asset.signature.publicKey ||
      !this.library.schema.validate(tx.asset.signature.publicKey, { format: 'publicKey' })) {
      throw new Error('Invalid public key');
    }
  }

  public async apply(tx: IConfirmedTransaction<SecondSignatureAsset>, block: SignedBlockType,
                     sender: any): Promise<void> {
    return this.modules.accounts.setAccountAndGet({
      address          : sender.address,
      secondPublicKey  : tx.asset.signature.publicKey,
      secondSignature  : 1,
      u_secondSignature: 0,
    })
      .then(() => void 0);
  }

  public undo(tx: IConfirmedTransaction<SecondSignatureAsset>, block: SignedBlockType, sender: any): Promise<void> {
    return this.modules.accounts.setAccountAndGet({
      address          : sender.address,
      secondPublicKey  : null,
      secondSignature  : 0,
      u_secondSignature: 1,
    })
      .then(() => void 0);
  }

  public applyUnconfirmed(tx: IBaseTransaction<SecondSignatureAsset>, sender: any): Promise<void> {
    return this.modules.accounts.setAccountAndGet({
      address          : sender.address,
      u_secondSignature: 0,
    })
      .then(() => void 0);
  }

  public undoUnconfirmed(tx: IBaseTransaction<SecondSignatureAsset>, sender: any): Promise<void> {
    if (sender.u_secondSignature || sender.secondSignature) {
      return Promise.reject('Second signature already enabled');
    }
    return this.modules.accounts.setAccountAndGet({
      address          : sender.address,
      u_secondSignature: 1,
    })
      .then(() => void 0);
  }

  public objectNormalize(tx: IBaseTransaction<SecondSignatureAsset>): IBaseTransaction<SecondSignatureAsset> {
    const report = this.library.schema.validate(tx.asset.signature, secondSignatureSchema);
    if (!report) {
      throw new Error(`Failed to validate signature schema: ${this.library.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
    }

    return tx;
  }

  public dbRead(raw: any): SecondSignatureAsset {
    if (!raw.s_publicKey) {
      return null;
    } else {
      const signature = { publicKey: raw.s_publicKey };
      // TODO: it used to return transactionId as well. Can be discarded?
      return { signature };
    }
  }

  // tslint:disable-next-line max-line-length
  public dbSave(tx: IConfirmedTransaction<SecondSignatureAsset> & { senderId: string }): { table: string; fields: string[]; values: any } {
    // tslint:disable object-literal-sort-keys
    return {
      table : this.dbTable,
      fields: this.dbFields,
      values: {
        publicKey    : Buffer.from(tx.asset.signature.publicKey, 'hex'),
        transactionId: tx.id,
      },
    };
    // tslint:enable object-literal-sort-keys
  }

}
