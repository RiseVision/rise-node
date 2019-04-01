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
  async function getAccountVote(address: Address): Promise<string[]> {
    const acc = await accModule.getAccount({ address });
    return acc.delegates;
  }

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

    // rmeove vote!
    let tx = await createVoteTransactionV2(delegateWallet, acc.username, false);
    await confirmTransactions([tx], false);
    acc = await accModule.getAccount({ address: delegateWallet.address });
    expect(acc.delegates).empty;

    // try to remove again
    tx = await createVoteTransactionV2(delegateWallet, acc.username, false, {
      nonce: 10,
    });
    await expect(confirmTransactions([tx], false)).rejectedWith(
      'Failed to remove vote'
    );
    acc = await accModule.getAccount({ address: delegateWallet.address });
    expect(acc.delegates).empty;

    // add vote
    tx = await createVoteTransactionV2(delegateWallet, acc.username, true);
    await confirmTransactions([tx], true);
    acc = await accModule.getAccount({ address: delegateWallet.address });
    expect(acc.delegates).deep.eq([acc.username]);

    // disallows voting for same username again
    tx = await createVoteTransactionV2(delegateWallet, acc.username, true, {
      nonce: 11,
    });
    await expect(confirmTransactions([tx], false)).rejectedWith(
      'Failed to add vote'
    );
  });
  it('should allow voting using mixed v1 and v2', async () => {
    const acc = await accModule.getAccount({ address: delegateWallet.address });
    expect(await getAccountVote(delegateWallet.address)).deep.eq([
      acc.username,
    ]);

    // remove with v2
    let tx = await createVoteTransactionV2(delegateWallet, acc.username, false);
    await confirmTransactions([tx], true);
    expect(await getAccountVote(delegateWallet.address)).deep.eq([]);

    // add with v2
    tx = await createVoteTransactionV2(delegateWallet, acc.username, true);
    await confirmTransactions([tx], true);
    expect(await getAccountVote(delegateWallet.address)).deep.eq([
      acc.username,
    ]);

    // remove with v1
    const tx2 = await createVoteTransactionV1(
      0,
      delegateWallet,
      delegateWallet.publicKey,
      false,
      { nonce: 3 }
    );
    await confirmTransactions([tx2], true);
    expect(await getAccountVote(delegateWallet.address)).deep.eq([]);
  });
  it('should disallow doublevotes for same acct with mixed tx types', async () => {
    const acc = await accModule.getAccount({ address: delegateWallet.address });
    expect(await getAccountVote(delegateWallet.address)).deep.eq([
      acc.username,
    ]);

    let txv1 = await createVoteTransactionV1(
      0,
      delegateWallet,
      delegateWallet.publicKey,
      false,
      { nonce: 3 }
    );
    let txv2 = await createVoteTransactionV2(
      delegateWallet,
      acc.username,
      false
    );

    // block with both txs will fail
    await expect(confirmTransactions([txv1, txv2], false)).rejectedWith(
      'Failed to remove vote'
    );
    expect(await getAccountVote(delegateWallet.address)).deep.eq([
      acc.username,
    ]);

    // With pool, one tx should go through
    await confirmTransactions([txv1, txv2], true);
    expect(await getAccountVote(delegateWallet.address)).deep.eq([]);
    expect(blocksModule.lastBlock.numberOfTransactions).eq(1);

    // try to re-add both
    txv1 = await createVoteTransactionV1(
      0,
      delegateWallet,
      delegateWallet.publicKey,
      true,
      { nonce: 3 }
    );
    txv2 = await createVoteTransactionV2(delegateWallet, acc.username, true);

    // block with both txs will fail
    await expect(confirmTransactions([txv1, txv2], false)).rejectedWith(
      'Maximum number of 1 votes exceeded'
    );
    expect(await getAccountVote(delegateWallet.address)).deep.eq([]);

    // with pool, one tx should go through
    await confirmTransactions([txv1, txv2], true);
    expect(await getAccountVote(delegateWallet.address)).deep.eq([
      acc.username,
    ]);
    expect(blocksModule.lastBlock.numberOfTransactions).eq(1);
  });
});
