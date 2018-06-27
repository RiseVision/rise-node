import { inject, injectable } from 'inversify';
import * as z_schema from 'z-schema';
import { TransactionType } from '../../helpers/';
import { IAccountsModule, ISystemModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { AccountsModel, SignaturesModel } from '../../models/';
import secondSignatureSchema from '../../schema/logic/transactions/secondSignature';
import { DBOp } from '../../types/genericTypes';
import { SignedBlockType } from '../block';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';
import { DelegatesModel } from '../../models';
import { VoteAsset } from './vote';
// tslint:disable-next-line interface-over-type-literal
export type SecondSignatureAsset = {
  signature: {
    publicKey: string;
  }
};

@injectable()
export class SecondSignatureTransaction extends BaseTransactionType<SecondSignatureAsset, SignaturesModel> {

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;

  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  // models
  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.signatures)
  private SignaturesModel: typeof SignaturesModel;

  constructor() {
    super(TransactionType.SIGNATURE);
  }

  public calculateFee(tx: IBaseTransaction<SecondSignatureAsset>, sender: AccountsModel, height: number): number {
    return this.systemModule.getFees(height).fees.secondsignature;
  }

  public getBytes(tx: IBaseTransaction<SecondSignatureAsset>, skipSignature: boolean,
                  skipSecondSignature: boolean): Buffer {
    return Buffer.from(tx.asset.signature.publicKey, 'hex');
  }

  /**
   * Returns asset, given Buffer containing it
   */
  public fromBytes(bytes: Buffer, tx?: IBaseTransaction<any>): SecondSignatureAsset {
    if (bytes === null) {
      return null;
    }
    // Splits the votes into 33 bytes chunks (1 for the sign, 32 for the publicKey)
    return {
      signature: {
        publicKey: bytes.toString('hex'),
      },
    };
  }

  public async verify(tx: IBaseTransaction<SecondSignatureAsset>, sender: AccountsModel): Promise<void> {
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
      !this.schema.validate(tx.asset.signature.publicKey, { format: 'publicKey' })) {
      throw new Error('Invalid public key');
    }
  }

  public async apply(tx: IConfirmedTransaction<SecondSignatureAsset>, block: SignedBlockType,
                     sender: AccountsModel): Promise<Array<DBOp<any>>> {
    const secondPublicKey = Buffer.from(tx.asset.signature.publicKey, 'hex');
    sender.applyValues({
      secondPublicKey,
      secondSignature  : 1,
      u_secondSignature: 0,
    });
    return [{
      model  : this.AccountsModel,
      options: {
        where: { address: sender.address },
      },
      type   : 'update',
      values : {
        secondPublicKey,
        secondSignature  : 1,
        u_secondSignature: 0,
      },
    }];
  }

  public async undo(tx: IConfirmedTransaction<SecondSignatureAsset>,
                    block: SignedBlockType,
                    sender: AccountsModel): Promise<Array<DBOp<any>>> {

    sender.applyValues({
      secondPublicKey  : null,
      secondSignature  : 0,
      u_secondSignature: 1,
    });
    return [{
      model  : this.AccountsModel,
      options: {
        where: { address: sender.address },
      },
      type   : 'update',
      values : {
        secondPublicKey  : null,
        secondSignature  : 0,
        u_secondSignature: 1,
      },
    }];
  }

  public async applyUnconfirmed(tx: IBaseTransaction<SecondSignatureAsset>,
                                sender: AccountsModel): Promise<Array<DBOp<any>>> {
    if (sender.u_secondSignature || sender.secondSignature) {
      throw new Error('Second signature already enabled');
    }
    sender.applyValues({
      u_secondSignature: 1,
    });
    return [{
      model  : this.AccountsModel,
      options: {
        where: { address: sender.address },
      },
      type   : 'update',
      values : {
        u_secondSignature: 1,
      },
    }];
  }

  public async undoUnconfirmed(tx: IBaseTransaction<SecondSignatureAsset>,
                               sender: AccountsModel): Promise<Array<DBOp<any>>> {

    sender.applyValues({
      u_secondSignature: 0,
    });
    return [{
      model  : this.AccountsModel,
      options: {
        where: { address: sender.address },
      },
      type   : 'update',
      values : {
        u_secondSignature: 0,
      },
    }];
  }

  public objectNormalize(tx: IBaseTransaction<SecondSignatureAsset>): IBaseTransaction<SecondSignatureAsset> {
    const report = this.schema.validate(tx.asset.signature, secondSignatureSchema);
    if (!report) {
      throw new Error(`Failed to validate signature schema: ${this.schema.getLastErrors()
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
  public dbSave(tx: IConfirmedTransaction<SecondSignatureAsset> & { senderId: string }): DBOp<any> {
    return {
      model : this.SignaturesModel,
      type  : 'create',
      values: {
        publicKey    : Buffer.from(tx.asset.signature.publicKey, 'hex'),
        transactionId: tx.id,
      },
    };
  }

  public async attachAssets(txs: Array<IConfirmedTransaction<SecondSignatureAsset>>) {
    const res = await this.SignaturesModel
      .findAll({
        where: { transactionId: txs.map((tx) => tx.id) },
      });

    const indexes = {};
    res.forEach((tx, idx) => indexes[tx.transactionId] = idx);

    txs.forEach((tx) => {
      if (typeof(indexes[tx.id]) === 'undefined') {
        throw new Error(`Couldn't restore asset for Signature tx: ${tx.id}`);
      }
      const info = res[indexes[tx.id]];
      tx.asset   = {
        signature: {
          publicKey: info.publicKey.toString('hex'),
        },
      };
    });
  }
}
