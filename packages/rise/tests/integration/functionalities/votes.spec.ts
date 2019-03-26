import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Sequelize } from 'sequelize-typescript';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import initializer from '../common/init';

import { SystemModule } from '@risevision/core';
import { AccountsSymbols } from '@risevision/core-accounts';
import {
  BlockLogic,
  BlocksModel,
  BlocksModule,
  BlocksModuleChain,
  BlocksSymbols,
} from '@risevision/core-blocks';
import { AccountsModelForDPOS } from '@risevision/core-consensus-dpos';
import {
  DelegatesModel,
  DelegatesModule,
  dPoSSymbols,
} from '@risevision/core-consensus-dpos';
import { Crypto } from '@risevision/core-crypto';
import { IAccountsModule, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { AccountsModelWith2ndSign } from '@risevision/core-secondsignature';
import {
  PoolManager,
  TransactionLogic,
  TransactionPool,
  TransactionsModule,
  TXSymbols,
} from '@risevision/core-transactions';
import { poolProcess } from '@risevision/core-transactions/tests/integration/utils';
import { toNativeTx } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { Address, IKeypair, Rise, RiseTransaction } from 'dpos-offline';
import { util } from 'protobufjs';
import { Op } from 'sequelize';
import { As } from 'type-tagger';
import {
  confirmTransactions,
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransactionV2,
  createSendTransactionV1,
  createVoteTransactionV1,
  enqueueAndProcessTransactions,
  getRandomDelegateWallet,
  tempDelegateWallets,
} from '../common/utils';
import pool = util.pool;
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
