import { inject, injectable, tagged } from 'inversify';
import SocketIO from 'socket.io';
import { Bus, ILogger, Sequence, TransactionType } from '../helpers/';
import { WrapInBalanceSequence } from '../helpers/decorators/wrapInSequence';
import { ITransactionLogic, ITransactionPoolLogic, VerificationType } from '../ioc/interfaces/logic';
import { IAccountsModule, IMultisignaturesModule, ITransactionsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { IBaseTransaction, MultisigAsset, MultiSignatureTransaction } from '../logic/transactions/';
import { AccountsModel } from '../models';

@injectable()
export class MultisignaturesModule implements IMultisignaturesModule {
  @inject(Symbols.logic.transactionPool)
  private transactionPool: ITransactionPoolLogic;

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence)
  public balancesSequence: Sequence;
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  @inject(Symbols.logic.transactions.createmultisig)
  private multiTx: MultiSignatureTransaction;

  /**
   * Gets the tx from the txID, verifies the given signature and
   * @return {Promise<void>}
   */
  @WrapInBalanceSequence
  public async processSignature(tx: { signature: string, transaction: string }) {
    const transaction = this.transactionsModule.getMultisignatureTransaction(tx.transaction);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const sender = await this.accountsModule.getAccount({address: transaction.senderId});
    if (!sender) {
      throw new Error('Sender not found');
    }

    // this looks useless but in reality due to the fact that this instance is also within the pool
    // it will update its data.
    transaction.signatures = transaction.signatures || [];

    if (transaction.type === TransactionType.MULTI) {
      await this.processMultiSigSignature(transaction, tx.signature, sender);
    } else {
      if (!sender.isMultisignature()) {
        throw new Error('Sender is not a multisig account');
      }
      // Tx is a normal tx but needs to be signed.
      await this.processNormalTxSignature(transaction, tx.signature, sender);
    }

    // Signature is verified so we add it to the valid signatures.
    transaction.signatures.push(tx.signature);

    // update readyness so that it can be inserted into pool
    const payload = this.transactionPool.multisignature.getPayload(transaction);
    if (!payload) {
      throw new Error('Cannot find payload for such multisig tx');
    }
    payload.ready = this.multiTx.ready(transaction, sender);

    await this.bus.message('signature', {transaction: tx.transaction, signature: tx.signature}, true);
    return null;
  }

  private async processNormalTxSignature(tx: IBaseTransaction<any>, signature: string, sender: AccountsModel) {
    const multisignatures = sender.multisignatures;

    if (tx.requesterPublicKey) {
      multisignatures.push(tx.senderPublicKey.toString('hex'));
    }

    tx.signatures = tx.signatures || [];
    if (tx.signatures.indexOf(signature) >= 0) {
      throw new Error('Signature already exists');
    }
    let verify = false;
    for (let i = 0; i < multisignatures.length && !verify; i++) {
      verify = this.transactionLogic.verifySignature(
        tx,
        Buffer.from(multisignatures[i], 'hex'),
        Buffer.from(signature, 'hex'),
        VerificationType.ALL
      );
    }

    if (!verify) {
      throw new Error('Failed to verify signature');
    }

    this.io.sockets.emit('multisignatures/signature/change', tx);

  }

  private async processMultiSigSignature(tx: IBaseTransaction<MultisigAsset>, signature: string, sender: AccountsModel) {
    // tslint:disable-next-line
    if (tx.asset.multisignature['signatures'] || tx.signatures.indexOf(signature) !== -1) {
      throw new Error('Permission to sign transaction denied');
    }
    let verify    = false;
    const allKeys = tx.asset.multisignature.keysgroup
      // add wannabe multisig member keys
      .map((k) => k.substring(1))
      // add current multisignature member keys
      .concat(sender.isMultisignature() ? sender.multisignatures : []);

    for (let i = 0; i < allKeys.length && !verify; i++) {
      const key = allKeys[i];
      verify    = this.transactionLogic.verifySignature(
        tx,
        Buffer.from(key, 'hex'),
        Buffer.from(signature, 'hex'),
        VerificationType.ALL
      );
    }
    if (!verify) {
      throw new Error('Failed to verify signature');
    }
  }
}
