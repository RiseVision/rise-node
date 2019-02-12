import { FilterAPIGetAccount } from '@risevision/core-accounts';
import {
  ICrypto,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import {
  TXBytes,
  TxLogicStaticCheck,
  TxSignatureVerify,
  TXSymbols,
} from '@risevision/core-transactions';
import { IBaseTransaction } from '@risevision/core-types';
import { decorate, inject, injectable } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { AccountsModelWith2ndSign } from '../AccountsModelWith2ndSign';

const ExtendableClass = WPHooksSubscriber(Object);
decorate(injectable(), ExtendableClass);

@injectable()
export class SignHooksListener extends ExtendableClass {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;
  @inject(TXSymbols.txBytes)
  private txBytes: TXBytes;

  @inject(Symbols.generic.crypto)
  private crypto: ICrypto;

  @TxLogicStaticCheck()
  public async txStaticCheck(
    tx: IBaseTransaction<any>,
    sender: AccountsModelWith2ndSign
  ) {
    if (sender.secondSignature && tx.signatures.length < 2) {
      throw new Error('Missing second signature');
    }
  }

  @TxSignatureVerify()
  public async txSignatureVerify(
    tx: IBaseTransaction<any, bigint>,
    hash: Buffer,
    sender: AccountsModelWith2ndSign
  ) {
    if (!!sender.secondSignature) {
      const verified = this.crypto.verify(
        hash,
        tx.signatures[1],
        sender.secondPublicKey
      );
      if (!verified) {
        throw new Error('Invalid second signature');
      }
    }
  }

  @FilterAPIGetAccount()
  public add2ndSignatureToAccount(
    accData: any,
    model: AccountsModelWith2ndSign
  ) {
    return {
      ...accData,
      secondPublicKey: model.secondPublicKey,
      secondSignature: model.secondSignature,
      unconfirmedSignature: model.u_secondSignature,
    };
  }
}
