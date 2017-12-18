import { inject, injectable, tagged } from 'inversify';
import { Bus, ILogger, Sequence, TransactionType } from '../helpers/';
import { ITransactionLogic } from '../ioc/interfaces/logic';
import { IAccountsModule, IMultisignaturesModule, ITransactionsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { IBaseTransaction, MultisigAsset } from '../logic/transactions/';

@injectable()
export class MultisignaturesModule implements IMultisignaturesModule {
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence)
  private balancesSequence: Sequence;

  /**
   * Gets the tx from the txID, verifies the given signature and
   * @param {{signature: any; transaction: string}} tx
   * @return {Promise<void>}
   */
  public async processSignature(tx: { signature: any, transaction: string }) {
    const transaction = this.transactionsModule.getMultisignatureTransaction(tx.transaction);
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

    await this.balancesSequence.addAndPromise(async () => {
      const multisigTx = this.transactionsModule
        .getMultisignatureTransaction(tx.transaction);
      if (!multisigTx) {
        throw new Error('Transaction not found');
      }

      const sender = await this.accountsModule.getAccount({ address: multisigTx.senderId });
      if (!sender) {
        throw new Error('Sender not found');
      }
      // this looks useless but in reality due to the fact that this instance is also within the pool
      // it will update its data.
      multisigTx.signatures = multisigTx.signatures || [];
      multisigTx.signatures.push(tx.signature);
      // TODO: Check if following line is needed
      // multisigTx.ready = this.multiTx.ready(multisigTx, sender);

      await this.bus.message('signature', { transaction: tx.transaction, signature: tx.signature }, true);
      return null;
    });
  }

  private async processNormalTxSignature(tx: IBaseTransaction<any>, signature: string) {
    const sender = await this.accountsModule.getAccount({ address: tx.senderId });
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
      verify = this.transactionLogic.verifySignature(tx, multisignatures[i], signature);
    }

    if (!verify) {
      throw new Error('Failed to verify signature');
    }

    this.io.sockets.emit('multisignatures/signature/change', tx);

  }

  private async processMultiSigSignature(tx: IBaseTransaction<MultisigAsset>, signature: string) {
    // tslint:disable-next-line
    if (tx.asset.multisignature['signatures'] || tx.signatures.indexOf(signature) !== -1) {
      throw new Error('Permission to sign transaction denied');
    }
    let verify = false;
    for (let i = 0; i < tx.asset.multisignature.keysgroup.length && !verify; i++) {
      const key = tx.asset.multisignature.keysgroup[i].substring(1);
      verify    = this.transactionLogic.verifySignature(tx, key, signature);
    }
    if (!verify) {
      throw new Error('Failed to verify signature');
    }
  }
}
