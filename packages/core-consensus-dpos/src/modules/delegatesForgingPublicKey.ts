import { IAccountsModel, IAccountsModule } from '@risevision/core-interfaces';
import { injectable } from 'inversify';
import { AccountsModelForDPOS } from '../models';

@injectable()
export class DelegatesForgingPublicKeyModule {
  private accountsModule: IAccountsModule<AccountsModelForDPOS>;

  public findDelegateWithPublicKey(pk: Buffer): any {
    return this.accountsModule.getAccount({
      forgingPK: pk,
    });
  }
}
