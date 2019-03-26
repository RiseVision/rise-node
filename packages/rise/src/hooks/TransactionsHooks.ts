import {
  TXBytes,
  TxSignatureVerify,
  TXSymbols,
} from '@risevision/core-transactions';
import { IBaseTransaction, ICrypto, Symbols } from '@risevision/core-types';
import * as assert from 'assert';
import { decorate, inject, injectable } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class TransactionsHooks extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(Symbols.generic.crypto)
  private crypto: ICrypto;
  @inject(TXSymbols.txBytes)
  private txBytes: TXBytes;

  @TxSignatureVerify()
  public async verifyTxSignature(
    tx: IBaseTransaction<any, bigint>,
    hash: Buffer
  ): Promise<void> {
    if (tx.senderPubData.length === 33) {
      assert.strictEqual(
        this.crypto.verify(hash, tx.signatures[0], tx.senderPubData.slice(1)),
        true
      );
    } else {
      assert.strictEqual(
        this.crypto.verify(hash, tx.signatures[0], tx.senderPubData),
        true
      );
    }
  }
}
