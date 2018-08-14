import { Symbols } from '@risevision/core-interfaces';
import { TxReadyFilter } from '@risevision/core-transactions';
import { IBaseTransaction } from '@risevision/core-types';
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

  @TxReadyFilter()
  public async readynessFilter(ready: boolean, tx: IBaseTransaction<any>, sender: AccountsModelWithMultisig) {
    if (!ready) {
      return ready;
    }
    return this.multisigUtils.txMultiSigReady(tx, sender);
  }
}
