import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import initializer from '../common/init';

import {
  BlocksModel,
  BlocksModule,
  BlocksSymbols,
} from '@risevision/core-blocks';
import { AccountsModelForDPOS } from '@risevision/core-consensus-dpos';
import {
  DelegatesModel,
  DelegatesModule,
  dPoSSymbols,
} from '@risevision/core-consensus-dpos';
import { ModelSymbols } from '@risevision/core-models';
import {
  PoolManager,
  TransactionPool,
  TXSymbols,
} from '@risevision/core-transactions';
import { IAccountsModule, Symbols } from '@risevision/core-types';
import { IKeypair, Rise } from 'dpos-offline';
import { Op } from 'sequelize';
import {
  confirmTransactions,
  createRandomWallet,
  createRegDelegateTransactionV2,
  getRandomDelegateWallet,
  tempDelegateWallets,
} from '../common/utils';
chai.use(chaiAsPromised);

// tslint:disable no-big-function no-unused-expression
describe('delegatesWithMultipleForgingKEys', () => {
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

  it('should return one forgingPK.', async () => {
    const { forgingPKs } = await delegatesModule.getDelegate(delegateUsername);
    expect(forgingPKs.length).deep.eq(1);
    expect(forgingPKs).deep.eq([
      {
        forgingPK: delegateWallet.publicKey,
        height: 1,
      },
    ]);
  });

  it('should allow to change forging PK', async () => {
    const acct = createRandomWallet();
    const tx = await createRegDelegateTransactionV2(
      delegateWallet,
      null,
      acct.publicKey
    );
    await confirmTransactions([tx], false);
    const { forgingPKs } = await delegatesModule.getDelegate(delegateUsername);
    expect(forgingPKs).deep.eq([
      {
        forgingPK: delegateWallet.publicKey,
        height: 1,
      },
      {
        forgingPK: acct.publicKey,
        height: blocksModule.lastBlock.height,
      },
    ]);
  });

  it('generateDelegateList should use the proper forging key', async function() {
    this.timeout(30000);
    const acct = createRandomWallet();
    async function checkPubKeyExist(which: 'acct' | 'orig') {
      const existingPK =
        which === 'acct' ? acct.publicKey : delegateWallet.publicKey;
      const nonExistingPK =
        which === 'acct' ? delegateWallet.publicKey : acct.publicKey;
      const list = await delegatesModule.generateDelegateList(
        blocksModule.lastBlock.height
      );
      expect(list.find((a) => a.equals(nonExistingPK))).undefined;
      expect(list.find((a) => a.equals(existingPK))).not.undefined;
    }
    const tx = await createRegDelegateTransactionV2(
      delegateWallet,
      null,
      acct.publicKey
    );
    tempDelegateWallets[acct.publicKey.toString('hex')] = {
      ...acct,
      origPK: delegateWallet.publicKey.toString('hex'),
    };
    await initializer.goToNextRound();
    await confirmTransactions([tx], false);

    (delegatesModule as any).delegatesListCache = []; // reset cache.
    await checkPubKeyExist('orig');

    // after goign to next round it should then get the proper new forgingKEy
    await initializer.goToNextRound();
    (delegatesModule as any).delegatesListCache = []; // reset cache.
    await checkPubKeyExist('acct');
    delete tempDelegateWallets[acct.publicKey.toString('hex')];

    // check that delegate cache publicKey is restored.
    await initializer.goToPrevRound();
    await checkPubKeyExist('orig');

    // try by removing the cache.
    (delegatesModule as any).delegatesListCache = []; // reset cache.
    await checkPubKeyExist('orig');
  });

  it('should allow multi round forward and backward with proper data in between', async function() {
    this.timeout(300000);
    const blocksModel: typeof BlocksModel = initializer.appManager.container.getNamed(
      ModelSymbols.model,
      BlocksSymbols.model
    );

    async function checkPubKeyExist(which: Buffer) {
      let list = await delegatesModule.generateDelegateList(
        blocksModule.lastBlock.height
      );
      expect(list.find((a) => a.equals(which))).not.undefined;
      list = await delegatesModule.generateDelegateList(
        blocksModule.lastBlock.height
      );
      expect(list.find((a) => a.equals(which))).not.undefined;
    }
    async function doRounds(remaining: number, prevPubKey: Buffer) {
      if (remaining === 0) {
        return;
      }
      // Previous public key should be the one in current round.
      await checkPubKeyExist(prevPubKey);
      const preList = await delegatesModule.generateDelegateList(
        blocksModule.lastBlock.height
      );

      const acct = createRandomWallet();
      // change delegate forgingPK.
      const tx = await createRegDelegateTransactionV2(
        delegateWallet,
        null,
        acct.publicKey
      );
      tempDelegateWallets[acct.publicKey.toString('hex')] = {
        ...acct,
        origPK: delegateWallet.publicKey.toString('hex'),
      };
      await confirmTransactions([tx], false);

      await initializer.goToNextRound();
      // Assert prev round was forged by prevPubKey.
      let b = await blocksModel.findAll({
        where: {
          generatorPublicKey: prevPubKey,
          height: {
            [Op.gte]: blocksModule.lastBlock.height - 101,
          },
        },
      });
      expect(b.length).eq(1);

      // Assert prev round was NOT forged by curPubKey
      b = await blocksModel.findAll({
        where: {
          generatorPublicKey: acct.publicKey,
          height: {
            [Op.gte]: blocksModule.lastBlock.height - 101,
          },
        },
      });
      expect(b.length).eq(0);

      await checkPubKeyExist(acct.publicKey);

      await doRounds(remaining - 1, acct.publicKey);

      await await initializer.goToPrevRound();
      // This is needed cause when next block is in next round the delegateList is going to change
      // due to calculations for end-of-round being already applied.
      await initializer.rawDeleteBlocks(1);
      // (delegatesModule as any).delegatesListCache = []; // reset cache.

      let postList = await delegatesModule.generateDelegateList(
        blocksModule.lastBlock.height
      );

      expect(preList).deep.eq(postList);
      // check that the list is equal to the prevList
      (delegatesModule as any).delegatesListCache = []; // reset cache.
      postList = await delegatesModule.generateDelegateList(
        blocksModule.lastBlock.height
      );
      expect(preList.map((a) => a.toString('hex'))).deep.eq(
        postList.map((a) => a.toString('hex'))
      );

      await checkPubKeyExist(prevPubKey);

      delete tempDelegateWallets[acct.publicKey.toString('hex')];
    }

    await doRounds(15, delegateWallet.publicKey);
  });

  describe('attackVectors', () => {
    it('should not allow changing forgingPK to an already existing one', async () => {
      const randomWallet = getRandomDelegateWallet();
      const tx = await createRegDelegateTransactionV2(
        delegateWallet,
        null,
        randomWallet.publicKey
      );

      const prevBlock = blocksModule.lastBlock;
      await expect(confirmTransactions([tx], false)).rejected;
      expect(blocksModule.lastBlock).deep.eq(prevBlock);
    });

    it('should not allow 2 delegates changing forgingPK to same key in same block', async () => {
      const otherDelegate = getRandomDelegateWallet();
      // there's a 1% chance this will fail. Eventually fix me!
      expect(otherDelegate).not.deep.eq(delegateWallet);

      const newWallet = createRandomWallet();
      const tx1 = await createRegDelegateTransactionV2(
        delegateWallet,
        null,
        newWallet.publicKey
      );

      const tx2 = await createRegDelegateTransactionV2(
        otherDelegate,
        null,
        newWallet.publicKey
      );

      const prevBlock = blocksModule.lastBlock;
      await expect(confirmTransactions([tx1, tx2], false)).rejectedWith(
        'Block is invalid!'
      );
      expect(blocksModule.lastBlock).deep.eq(prevBlock);

      await confirmTransactions([tx1, tx2], true);
      expect(blocksModule.lastBlock.numberOfTransactions).eq(1);
      const txPool = initializer.appManager.container.get<TransactionPool>(
        TXSymbols.pool
      );
      const poolManager = initializer.appManager.container.get<PoolManager>(
        TXSymbols.poolManager
      );
      await poolManager.processPool();
      expect(txPool.unconfirmed.list()).deep.eq([]);

      await initializer.rawMineBlocks(1);
      expect(txPool.unconfirmed.list()).deep.eq([]);
    });
  });
});
