import { AccountApisGetAccount } from '@risevision/core';
import { WPHooksSubscriber } from 'mangiafuoco';
import { AccountsModelWith2ndSign } from '../AccountsModelWith2ndSign';
export class Core extends WPHooksSubscriber(Object) {
  @AccountApisGetAccount()
  public add2ndSignatureToAccount(accData: any, model: AccountsModelWith2ndSign) {
    return {
      ...accData,
      secondPublicKey: model.secondPublicKey,
      secondSignature: model.secondSignature,
      unconfirmedSignature: model.u_secondSignature,
    };
  }
}
