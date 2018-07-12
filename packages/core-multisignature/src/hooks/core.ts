import { AccountApisGetAccount } from '@risevision/core';
import { WPHooksSubscriber } from 'mangiafuoco';
import { AccountsModelWithMultisig } from '../models/AccountsModelWithMultisig';
export class Core extends WPHooksSubscriber(Object) {
  @AccountApisGetAccount()
  public addMultisigDataToAccount(accData: any, model: AccountsModelWithMultisig) {
    return {
      ...accData,
      multisignatures: model.multisignatures,
      u_multisignatures: model.u_multisignatures,
    };
  }
}
