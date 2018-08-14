import { IAccountsModel, ITransactionLogic, Symbols, VerificationType } from '@risevision/core-interfaces';
import { TxLogicVerify, TxReadyFilter } from '@risevision/core-transactions';
import { IBaseTransaction, IConfirmedTransaction } from '@risevision/core-types';
import { decorate, inject, injectable } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { AccountsModelWithMultisig } from '../models/AccountsModelWithMultisig';
import { MultiSigUtils } from '../utils';
import { MultisigSymbols } from '../helpers';

const ExtendableClass = WPHooksSubscriber(Object)
decorate(injectable(), ExtendableClass);

@injectable()
export class MultisigHooksListener extends ExtendableClass {

  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  @inject(MultisigSymbols.utils)
  private multisigUtils: MultiSigUtils;

  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  @TxReadyFilter()
  public async readynessFilter(ready: boolean, tx: IBaseTransaction<any>, sender: AccountsModelWithMultisig) {
    if (!ready) {
      return ready;
    }
    return this.multisigUtils.txMultiSigReady(tx, sender);
  }

  @TxLogicVerify()
  public async txLogicVerify(tx: IBaseTransaction<any>, sender: AccountsModelWithMultisig, requester: AccountsModelWithMultisig) {
    if (!this.multisigUtils.txMultiSigReady(tx, sender)) {
      throw new Error('MultiSig Transaction is not ready');
    }

    if (tx.requesterPublicKey && (!sender.isMultisignature() || requester == null)) {
      throw new Error('Account or requester account is not multisignature');
    }

    if (tx.requesterPublicKey && sender.secondSignature && !tx.signSignature &&
      (tx as IConfirmedTransaction<any>).blockId !== this.genesisBlock.id) {
      throw new Error('Missing sender second signature');
    }
    // TODO: This looks unnecessary. as there is no real need for requester to give his second signature.

    // // If second signature provided, check if sender has one enabled
    // if (!tx.requesterPublicKey && !sender.secondSignature && (tx.signSignature && tx.signSignature.length > 0)) {
    //   throw new Error('Sender does not have a second signature');
    // }
    //
    // // Check for missing requester second signature
    // if (tx.requesterPublicKey && requester.secondSignature && !tx.signSignature) {
    //   throw new Error('Missing requester second signature');
    // }
    //
    // // If second signature provided, check if requester has one enabled
    // if (tx.requesterPublicKey && !requester.secondSignature && (tx.signSignature && tx.signSignature.length > 0)) {
    //   throw new Error('Requester does not have a second signature');
    // }

    const multisignatures = (sender.multisignatures || sender.u_multisignatures || []).slice();

    if (tx.asset && tx.asset.multisignature && tx.asset.multisignature.keysgroup) {
      for (const key of tx.asset.multisignature.keysgroup) {
        if (!key || typeof key !== 'string') {
          throw new Error('Invalid member in keysgroup');
        }
        multisignatures.push(key.slice(1));
      }
    } else if (tx.requesterPublicKey) {
      if (sender.multisignatures.indexOf(tx.requesterPublicKey.toString('hex')) < 0) {
        throw new Error('Account does not belong to multisignature group');
      }
    }

    // In multisig accounts
    if (Array.isArray(tx.signatures) && tx.signatures.length > 0) {
      // check that signatures are unique.
      const duplicatedSignatures = tx.signatures.filter((sig, idx, arr) => arr.indexOf(sig) !== idx);
      if (duplicatedSignatures.length > 0) {
        throw new Error('Encountered duplicate signature in transaction');
      }

      // Verify multisignatures are valid and belong to some of prev. calculated multisignature publicKeys
      for (const sig of tx.signatures) {
        let valid = false;
        for (let s = 0; s < multisignatures.length && !valid; s++) {
          valid = this.txLogic.verifySignature(
            tx,
            Buffer.from(multisignatures[s], 'hex'),
            Buffer.from(sig, 'hex'),
            VerificationType.ALL
          );
        }

        if (!valid) {
          throw new Error('Failed to verify multisignature');
        }
      }
    }
  }
}
