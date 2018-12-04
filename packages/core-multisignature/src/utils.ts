import { ITransactionLogic, Symbols } from '@risevision/core-interfaces';
import { IBaseTransaction, TransactionType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { AccountsModelWithMultisig } from './models/AccountsModelWithMultisig';

/**
 * Utility methods for multisig functionality.
 * Contains methods to verify txs and other helper methods to avoid code duplication
 */
@injectable()
export class MultiSigUtils {
  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  /**
   * Checks if the transaction is ready on a multisignature stand point.
   * Note that if account is not multisig (nor the tx) this returns true.
   * @param tx the tx to validate
   * @param sender the sender of such tx.
   */
  public txMultiSigReady(
    tx: IBaseTransaction<any>,
    sender: AccountsModelWithMultisig
  ) {
    const txKeys =
      tx.type === TransactionType.MULTI
        ? tx.asset.multisignature.keysgroup.map((k) => k.substr(1))
        : [];
    const accountKeys = sender.isMultisignature() ? sender.multisignatures : [];
    const intersectionKeys = _.intersection(accountKeys, txKeys);
    const givenSignatures = tx.signatures || [];
    // If account is multisig, to change keysgroup the tx needs to be signed by
    if (sender.isMultisignature()) {
      return (
        givenSignatures.length >=
        txKeys.length + sender.multimin - intersectionKeys.length
      );
    } else {
      return givenSignatures.length === txKeys.length;
    }
  }

  /**
   * Utility method to verify if a certain pubKey has signed the full transaction
   * @param tx the Transaction to check
   * @param pubKey the pubKey to test
   */
  public isTxSignedByPubKey(
    tx: IBaseTransaction<any, bigint>,
    pubKey: Buffer
  ): boolean {
    if (tx.signatures && tx.signatures.length > 0) {
      let verified = false;
      for (let i = 0; i < tx.signatures.length && !verified; i++) {
        const signature = tx.signatures[i];
        verified = this.txLogic.verifySignature(tx, pubKey, signature);
      }
      return verified;
    }
    return false;
  }
}
