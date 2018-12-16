import { FilterAPIGetAccount } from '@risevision/core-accounts';
import {
  ICrypto,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import {
  TxLogicStaticCheck,
  TxLogicVerify,
  TxReadyFilter,
} from '@risevision/core-transactions';
import { IBaseTransaction } from '@risevision/core-types';
import { decorate, inject, injectable } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { MultisigSymbols } from '../helpers';
import { AccountsModelWithMultisig } from '../models/AccountsModelWithMultisig';
import { MultiSigUtils } from '../utils';

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

  @inject(Symbols.generic.crypto)
  private crypto: ICrypto;

  @TxReadyFilter()
  public async readynessFilter(
    ready: boolean,
    tx: IBaseTransaction<any>,
    sender: AccountsModelWithMultisig
  ) {
    if (!ready) {
      return ready;
    }
    return this.multisigUtils.txMultiSigReady(tx, sender);
  }

  @TxLogicStaticCheck()
  public async txLogicStaticChecks(
    tx: IBaseTransaction<any>,
    sender: AccountsModelWithMultisig
  ) {
    if (
      tx.asset &&
      tx.asset.multisignature &&
      tx.asset.multisignature.keysgroup
    ) {
      for (const key of tx.asset.multisignature.keysgroup) {
        if (!key || typeof key !== 'string') {
          throw new Error('Invalid member in keysgroup');
        }
      }
    }

    if (!this.multisigUtils.txMultiSigReady(tx, sender)) {
      throw new Error(`MultiSig Transaction ${tx.id} is not ready`);
    }

    // In multisig accounts
    if (Array.isArray(tx.signatures) && tx.signatures.length > 0) {
      // check that signatures are unique.
      const duplicatedSignatures = tx.signatures.filter(
        (sig, idx, arr) => arr.indexOf(sig) !== idx
      );
      if (duplicatedSignatures.length > 0) {
        throw new Error('Encountered duplicate signature in transaction');
      }
    }
  }

  @TxLogicVerify()
  // tslint:disable-next-line cognitive-complexity
  public async txLogicVerify(
    tx: IBaseTransaction<any, bigint>,
    sender: AccountsModelWithMultisig
  ) {
    const multisignatures = (
      sender.multisignatures ||
      sender.u_multisignatures ||
      []
    ).slice();

    if (
      tx.asset &&
      tx.asset.multisignature &&
      tx.asset.multisignature.keysgroup
    ) {
      for (const key of tx.asset.multisignature.keysgroup) {
        multisignatures.push(key.slice(1));
      }
    }

    // In multisig accounts
    if (Array.isArray(tx.signatures) && tx.signatures.length > 0) {
      // check that signatures are unique.
      const duplicatedSignatures = tx.signatures.filter(
        (sig, idx, arr) => arr.indexOf(sig) !== idx
      );
      if (duplicatedSignatures.length > 0) {
        throw new Error('Encountered duplicate signature in transaction');
      }

      // Verify multisignatures are valid and belong to some of prev. calculated multisignature publicKeys
      for (const sig of tx.signatures) {
        let valid = false;
        for (let s = 0; s < multisignatures.length && !valid; s++) {
          valid = this.verifySignature(
            tx,
            Buffer.from(multisignatures[s], 'hex'),
            sig
          );
          // Avoid same publicKey to provide 2 diff signatures to the same tx
          if (valid) {
            multisignatures.splice(s, 1);
          }
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
      multisignatures: accData.multisignatures,
      u_multisignatures: accData.u_multisignatures,
    };
  }

  public verifySignature(
    tx: IBaseTransaction<any, bigint>,
    publicKey: Buffer,
    signature: Buffer
  ): boolean {
    if (!signature) {
      return false;
    }
    const hash = this.txLogic.getHash(tx);
    return this.crypto.verify(hash, signature, publicKey);
  }
}
