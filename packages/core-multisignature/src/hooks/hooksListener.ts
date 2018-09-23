import { ITransactionLogic, Symbols, VerificationType } from '@risevision/core-interfaces';
import { TxLogicStaticCheck, TxLogicVerify, TxReadyFilter } from '@risevision/core-transactions';
import { IBaseTransaction } from '@risevision/core-types';
import { decorate, inject, injectable } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { AccountsModelWithMultisig } from '../models/AccountsModelWithMultisig';
import { MultiSigUtils } from '../utils';
import { MultisigSymbols } from '../helpers';
import { FilterAPIGetAccount } from '@risevision/core-accounts';

const ExtendableClass = WPHooksSubscriber(Object);
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

  @TxLogicStaticCheck()
  public async txLogicStaticChecks(tx: IBaseTransaction<any>, sender: AccountsModelWithMultisig, requester: AccountsModelWithMultisig) {
    if (tx.requesterPublicKey && (!sender.isMultisignature() || requester == null)) {
      throw new Error('Account or requester account is not multisignature');
    }

    if (tx.asset && tx.asset.multisignature && tx.asset.multisignature.keysgroup) {
      for (const key of tx.asset.multisignature.keysgroup) {
        if (!key || typeof key !== 'string') {
          throw new Error('Invalid member in keysgroup');
        }
      }
    } else if (tx.requesterPublicKey) {
      if (sender.multisignatures.indexOf(tx.requesterPublicKey.toString('hex')) < 0) {
        throw new Error('Account does not belong to multisignature group');
      }
    }

    if (!this.multisigUtils.txMultiSigReady(tx, sender)) {
      throw new Error('MultiSig Transaction is not ready');
    }

    // In multisig accounts
    if (Array.isArray(tx.signatures) && tx.signatures.length > 0) {
      // check that signatures are unique.
      const duplicatedSignatures = tx.signatures.filter((sig, idx, arr) => arr.indexOf(sig) !== idx);
      if (duplicatedSignatures.length > 0) {
        throw new Error('Encountered duplicate signature in transaction');
      }
    }
  }

  @TxLogicVerify()
  public async txLogicVerify(tx: IBaseTransaction<any>, sender: AccountsModelWithMultisig, requester: AccountsModelWithMultisig) {
    const multisignatures = (sender.multisignatures || sender.u_multisignatures || []).slice();

    if (tx.asset && tx.asset.multisignature && tx.asset.multisignature.keysgroup) {
      for (const key of tx.asset.multisignature.keysgroup) {
        multisignatures.push(key.slice(1));
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
            sig,
            VerificationType.ALL
          );
        }

        if (!valid) {
          throw new Error('Failed to verify multisignature');
        }
      }
    }
  }

  @FilterAPIGetAccount()
  public getAccountFilter(what: any, accData: AccountsModelWithMultisig) {
    return {
      ...what,
      multisignatures  : accData.multisignatures,
      u_multisignatures: accData.u_multisignatures,
    };
  }
}
