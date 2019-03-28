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
import { Address, IKeypair, Rise } from 'dpos-offline';
import {
  confirmTransactions,
  createVoteTransactionV1,
  createVoteTransactionV2,
  getRandomDelegateWallet,
} from '../common/utils';

chai.use(chaiAsPromised);

// tslint:disable no-big-function no-unused-expression
describe('votes', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  let accModule: IAccountsModule<AccountsModelForDPOS>;
  let delegateWallet: IKeypair & { address: Address };
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
    accModule = initializer.appManager.container.get(Symbols.modules.accounts);
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

  it('should allow to vote using tx type v1', async () => {
    let acc = await accModule.getAccount({
      address: Rise.calcAddress(delegateWallet.publicKey),
    });
    expect(acc.delegates).not.empty;

    // remove vote should be allowed
    await createVoteTransactionV1(
      1,
      delegateWallet,
      delegateWallet.publicKey,
      false
    );
    acc = await accModule.getAccount({
      address: Rise.calcAddress(delegateWallet.publicKey),
    });
    expect(acc.delegates).empty;

    // removing twice should be disallowed
    await expect(
      confirmTransactions(
        [
          await createVoteTransactionV1(
            0,
            delegateWallet,
            delegateWallet.publicKey,
            false,
            { nonce: 30 }
          ),
        ],
        false
      )
    ).rejectedWith('Failed to remove vote');
    acc = await accModule.getAccount({
      address: Rise.calcAddress(delegateWallet.publicKey),
    });
    expect(acc.delegates).empty;

    // add vote should be allowed
    await createVoteTransactionV1(
      1,
      delegateWallet,
      delegateWallet.publicKey,
      true,
      { nonce: 3 }
    );
    acc = await accModule.getAccount({
      address: Rise.calcAddress(delegateWallet.publicKey),
    });
    expect(acc.delegates).not.empty;
    const curHeight = blocksModule.lastBlock.height;

    // try to re-add same vote.
    const tx = await createVoteTransactionV1(
      0,
      delegateWallet,
      delegateWallet.publicKey,
      true,
      { nonce: 2 }
    );
    await expect(confirmTransactions([tx], false)).rejectedWith(
      'Failed to add vote'
    );
    expect(blocksModule.lastBlock.height).eq(curHeight);
  });
  it('should allow to vote using tx type v2', async () => {
    let acc = await accModule.getAccount({ address: delegateWallet.address });
    let tx = await createVoteTransactionV2(delegateWallet, acc.username, false);
    await confirmTransactions([tx], false);
    acc = await accModule.getAccount({ address: delegateWallet.address });
    expect(acc.delegates).empty;

    tx = await createVoteTransactionV2(delegateWallet, acc.username, true);
    await confirmTransactions([tx], true);
    acc = await accModule.getAccount({ address: delegateWallet.address });
    expect(acc.delegates).deep.eq([acc.username]);

    // disallows vo
  });
  it('should allow voting using mixed v1 and v2');
  it('should disallow several cases for tx type v2');
  it('should disallow several cases for tx type v1');
});
