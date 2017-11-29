import { IDatabase } from 'pg-promise';
import * as z_schema from 'z-schema';
import { Bus, Ed, ILogger, Sequence, TransactionType } from '../helpers/';
import { AccountLogic, SignedAndChainedBlockType, TransactionLogic } from '../logic/';
import { IBaseTransaction, MultisigAsset, MultiSignatureTransaction } from '../logic/transactions/';
import { AccountsModule } from './accounts';
import { TransactionsModule } from './transactions';

export class MultisignaturesModule {
  private multiTx: MultiSignatureTransaction;
  private modules: {
    transactions: TransactionsModule,
    accounts: AccountsModule,
  };

  constructor(public library: {
    logger: ILogger,
    db: IDatabase<any>,
    network: any,
    schema: z_schema,
    ed: Ed,
    bus: Bus,
    balancesSequence: Sequence,
    logic: {
      transaction: TransactionLogic
      account: AccountLogic
    }
    genesisblock: SignedAndChainedBlockType
  }) {

    this.multiTx = this.library.logic.transaction.attachAssetType(
      TransactionType.MULTI,
      new MultiSignatureTransaction({
        account    : this.library.logic.account,
        logger     : this.library.logger,
        network    : this.library.network,
        schema     : this.library.schema,
        transaction: this.library.logic.transaction,
      })
    );
  }

  /**
   * Gets the tx from the txID, verifies the given signature and
   * @param {{signature: any; transaction: string}} tx
   * @return {Promise<void>}
   */
  public async processSignature(tx: { signature: any, transaction: string }) {
    const transaction = this.modules.transactions.getMultisignatureTransaction(tx.transaction);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.type === TransactionType.MULTI) {
      transaction.signatures = transaction.signatures || [];
      await this.processMultiSigSignature(transaction, tx.signature);
    } else {
      // Tx is a normal tx but needs to be signed.
      await this.processNormalTxSignature(transaction, tx.signature);
    }

    await this.library.balancesSequence.addAndPromise(async () => {
      const multisigTx = this.modules.transactions.getMultisignatureTransaction(tx.transaction);
      if (!multisigTx) {
        throw new Error('Transaction not found');
      }

      const sender = await this.modules.accounts.getAccount({ address: multisigTx.senderId });
      if (!sender) {
        throw new Error('Sender not found');
      }
      // this looks useless but in reality due to the fact that this instance is also within the pool
      // it will update its data.
      multisigTx.signatures = multisigTx.signatures || [];
      multisigTx.signatures.push(tx.signature);
      // TODO: Check if following line is needed
      // multisigTx.ready = this.multiTx.ready(multisigTx, sender);

      await this.library.bus.message('signature', { transaction: tx.transaction, signature: tx.signature }, true);
      return null;
    });
  }

  private async processNormalTxSignature(tx: IBaseTransaction<any>, signature: string) {
    const sender = await this.modules.accounts.getAccount({ address: tx.senderId });
    if (!sender) {
      throw new Error('Multisignature account not found');
    }
    const multisignatures = sender.multisignatures;

    if (tx.requesterPublicKey) {
      multisignatures.push(tx.senderPublicKey);
    }

    tx.signatures = tx.signatures || [];
    if (tx.signatures.indexOf(signature) >= 0) {
      throw new Error('Signature already exists');
    }
    let verify = false;
    for (let i = 0; i < multisignatures.length && !verify; i++) {
      verify = this.library.logic.transaction.verifySignature(tx, multisignatures[i], signature);
    }

    if (!verify) {
      throw new Error('Failed to verify signature');
    }

    this.library.network.io.sockets.emit('multisignatures/signature/change', tx);

  }

  private async processMultiSigSignature(tx: IBaseTransaction<MultisigAsset>, signature: string) {
    // tslint:disable-next-line
    if (tx.asset.multisignature['signatures'] || tx.signatures.indexOf(signature) !== -1) {
      throw new Error('Permission to sign transaction denied');
    }
    let verify = false;
    for (let i = 0; i < tx.asset.multisignature.keysgroup.length && !verify; i++) {
      const key = tx.asset.multisignature.keysgroup[i].substring(1);
      verify    = this.library.logic.transaction.verifySignature(tx, key, signature);
    }
    if (!verify) {
      throw new Error('Failed to verify signature');
    }
  }
}
