import {
  IAccountsModule,
  ILogger,
  ISequence,
  ITransactionLogic,
  ITransactionPool,
  Symbols,
  VerificationType,
} from '@risevision/core-interfaces';
import { IBaseTransaction, TransactionType } from '@risevision/core-types';
import { logOnly, WrapInBalanceSequence } from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { MultisigSymbols } from './helpers';
import { AccountsModelWithMultisig } from './models/AccountsModelWithMultisig';
import { MultisigAsset, MultiSignatureTransaction } from './transaction';
import { MultisigTransportModule } from './transport';

@injectable()
export class MultisignaturesModule {
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.balancesSequence)
  public balancesSequence: ISequence;
  @inject(Symbols.logic.txpool)
  private txPool: ITransactionPool;

  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule<AccountsModelWithMultisig>;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(Symbols.logic.transaction)
  @named(MultisigSymbols.tx)
  private multiTx: MultiSignatureTransaction;

  @inject(MultisigSymbols.multiSigTransport)
  private multiTransport: MultisigTransportModule;

  // Called by PostSignatureRequest.
  public async onNewSignature(tx: {
    signature: Buffer;
    transaction: string;
    relays: number;
  }) {
    await this.processSignature(tx);
    await this.multiTransport.onSignature(tx, true).catch(logOnly(this.logger));
  }
  /**
   * Gets the tx from the txID, verifies the given signature and
   * @return {Promise<void>}
   */
  @WrapInBalanceSequence
  private async processSignature(tx: {
    signature: Buffer;
    transaction: string;
  }) {
    if (!this.txPool.pending.has(tx.transaction)) {
      throw new Error('Transaction not found');
    }
    const transaction = this.txPool.pending.get(tx.transaction).tx;

    const sender = await this.accountsModule.getAccount({
      address: transaction.senderId,
    });
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
    const payload = this.txPool.pending.getPayload(transaction);
    if (!payload) {
      throw new Error('Cannot find payload for such multisig tx');
    }
    payload.ready = await this.multiTx.ready(transaction, sender);
  }

  private async processNormalTxSignature(
    tx: IBaseTransaction<any>,
    signature: Buffer,
    sender: AccountsModelWithMultisig
  ) {
    const multisignatures = sender.multisignatures;

    if (tx.requesterPublicKey) {
      multisignatures.push(tx.senderPublicKey.toString('hex'));
    }

    tx.signatures = tx.signatures || [];
    if (tx.signatures.some((s) => s.compare(signature) === 0)) {
      throw new Error('Signature already exists');
    }
    let verify = false;
    for (let i = 0; i < multisignatures.length && !verify; i++) {
      verify = this.transactionLogic.verifySignature(
        tx,
        Buffer.from(multisignatures[i], 'hex'),
        signature,
        VerificationType.ALL
      );
    }

    if (!verify) {
      throw new Error('Failed to verify signature');
    }
  }

  private async processMultiSigSignature(
    tx: IBaseTransaction<MultisigAsset>,
    signature: Buffer,
    sender: AccountsModelWithMultisig
  ) {
    // tslint:disable-next-line
    if (
      tx.asset.multisignature.signatures ||
      tx.signatures.indexOf(signature) !== -1
    ) {
      throw new Error('Permission to sign transaction denied');
    }
    let verify = false;
    const allKeys = tx.asset.multisignature.keysgroup
      // add wannabe multisig member keys
      .map((k) => k.substring(1))
      // add current multisignature member keys
      .concat(sender.isMultisignature() ? sender.multisignatures : []);

    for (let i = 0; i < allKeys.length && !verify; i++) {
      const key = allKeys[i];
      verify = this.transactionLogic.verifySignature(
        tx,
        Buffer.from(key, 'hex'),
        signature,
        VerificationType.ALL
      );
    }
    if (!verify) {
      throw new Error('Failed to verify signature');
    }
  }
}
