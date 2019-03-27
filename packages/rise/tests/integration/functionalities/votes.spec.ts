import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import initializer from '../common/init';

import { BlocksModule } from '@risevision/core-blocks';
import { AccountsModelForDPOS } from '@risevision/core-consensus-dpos';
import {
  DelegatesModel,
  DelegatesModule,
  dPoSSymbols,
} from '@risevision/core-consensus-dpos';
import { ModelSymbols } from '@risevision/core-models';
import { IAccountsModule, Symbols } from '@risevision/core-types';
import { IKeypair, Rise } from 'dpos-offline';
import { getRandomDelegateWallet } from '../common/utils';
chai.use(chaiAsPromised);

// tslint:disable no-big-function no-unused-expression
describe('votes', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  let delegateWallet: IKeypair;
  let delegatesModule: DelegatesModule;
  let blocksModule: BlocksModule;
  let delegatesModel: typeof DelegatesModel;
  let delegateUsername: string;
  before(async () => {
    delegateWallet = getRandomDelegateWallet();
  });
  beforeEach(async () => {
    blocksModule = initializer.appManager.container.get(Symbols.modules.blocks);
    delegatesModule = initializer.appManager.container.get(
      dPoSSymbols.modules.delegates
    );
    const accModule: IAccountsModule<
      AccountsModelForDPOS
    > = initializer.appManager.container.get(Symbols.modules.accounts);
    delegatesModel = initializer.appManager.container.getNamed(
      ModelSymbols.model,
      dPoSSymbols.models.delegates
    );
    const acc = await accModule.getAccount({
      address: Rise.calcAddress(delegateWallet.publicKey),
    });
    delegateUsername = acc.username;
    expect(delegateUsername).not.empty;
  });

  it('should allow to vote using tx type v1');
  it('should allow to vote using tx type v2');
  it('should allow voting using mixed v1 and v2');
  it('should disallow several cases for tx type v2');
  it('should disallow several cases for tx type v1');
});
