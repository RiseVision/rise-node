import { ExceptionsManager } from '@risevision/core-exceptions';
import { ICrypto } from '@risevision/core-interfaces';
import { AccountsModelWith2ndSign } from '@risevision/core-secondsignature';
import { TXBytes } from '@risevision/core-transactions';
import { IBaseTransaction } from '@risevision/core-types';
import * as assert from 'assert';
import * as supersha from 'supersha';

export const genericExceptionSymbols = {
  secondSignatureVerification: Symbol.for('secondSignVerification'),
};

export function secondSignatureExc(
  excManager: ExceptionsManager,
  crypto: ICrypto,
  txBytes: TXBytes
) {
  excManager.registerExceptionHandler(
    genericExceptionSymbols.secondSignatureVerification,
    'secondSignatureVerification',
    {
      canHandle(
        obj: any /*SignHooksListener*/,
        tx: IBaseTransaction<any, bigint>,
        hash: Buffer,
        sender: AccountsModelWith2ndSign
      ) {
        return sender.secondSignature === 1;
      },
      handle(
        obj: any /*SignHooksListener*/,
        tx: IBaseTransaction<any, bigint>,
        hash: Buffer,
        sender: AccountsModelWith2ndSign
      ) {
        assert.strictEqual(
          // new standard method
          crypto.verify(hash, tx.signatures[1], sender.secondPublicKey) ||
            // try old method
            crypto.verify(
              supersha.sha256(
                Buffer.concat([txBytes.signableBytes(tx), tx.signatures[0]])
              ),
              tx.signatures[1],
              sender.secondPublicKey
            ),
          true,
          'Second signature is not valid'
        );
      },
    }
  );
}
