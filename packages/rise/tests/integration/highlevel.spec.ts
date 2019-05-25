// tslint:disable
import 'reflect-metadata';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as supertest from 'supertest';
import initializer from './common/init';
import {
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransactionV1,
  createSecondSignTransactionV1,
  createSendTransactionV1,
  createVoteTransactionV1,
  enqueueAndProcessTransactions,
  getRandomDelegateWallet,
  getSelfTransportPeer,
} from './common/utils';
import {
  BlockLogic,
  BlocksModel,
  BlocksModule,
  BlocksSymbols,
} from '@risevision/core-blocks';
import {
  TransactionLogic,
  TransactionPool,
  TransactionsModel,
  TransactionsModule,
  TXSymbols,
} from '@risevision/core-transactions';
import { wait } from '@risevision/core-utils';
import { AccountsModule, AccountsSymbols } from '@risevision/core-accounts';
import { SystemModule } from '@risevision/core';
import { toNativeTx } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { TransportModule } from '@risevision/core-p2p';
import { Crypto } from '@risevision/core-crypto';
import { p2pSymbols } from '@risevision/core-p2p';
import { ModelSymbols } from '@risevision/core-models';
import { AccountsModelForDPOS } from '@risevision/core-consensus-dpos';
import { AccountsModelWith2ndSign } from '@risevision/core-secondsignature';
import { PoolManager } from '@risevision/core-transactions';
import {
  Address,
  IAccountsModule,
  IKeypair,
  Symbols,
} from '@risevision/core-types';

// tslint:disable no-unused-expression
chai.use(chaiAsPromised);
describe('highlevel checks', function() {
  this.timeout(10000);
  const funds = Math.pow(10, 11);
  let senderAccount: IKeypair & { address: Address };
  initializer.setup();
  let blockLogic: BlockLogic;
  let blocksModule: BlocksModule;
  let accModule: IAccountsModule<
    AccountsModelForDPOS & AccountsModelWith2ndSign
  >;
  let txModule: TransactionsModule;
  let txPool: TransactionPool;
  let transportModule: TransportModule;
  let txPoolManager: PoolManager;
  let txLogic: TransactionLogic;
  let systemModule: SystemModule;
  let ed: Crypto;

  let txModel: typeof TransactionsModel;
  let blocksModel: typeof BlocksModel;
  beforeEach(async () => {
    const { wallet: randomAccount } = await createRandomAccountWithFunds(funds);
    senderAccount = randomAccount;
    ed = initializer.appManager.container.get(Symbols.generic.crypto);
    blocksModule = initializer.appManager.container.get(
      BlocksSymbols.modules.blocks
    );
    accModule = initializer.appManager.container.get(AccountsSymbols.module);
    txModule = initializer.appManager.container.get(TXSymbols.module);
    transportModule = initializer.appManager.container.get(
      p2pSymbols.modules.transport
    );
    txPool = initializer.appManager.container.get(TXSymbols.pool);
    txLogic = initializer.appManager.container.get(TXSymbols.logic);
    systemModule = initializer.appManager.container.get(Symbols.modules.system);
    txPoolManager = initializer.appManager.container.get(TXSymbols.poolManager);
    txModel = initializer.appManager.container.getNamed(
      ModelSymbols.model,
      TXSymbols.models.model
    );
    blocksModel = initializer.appManager.container.getNamed(
      ModelSymbols.model,
      BlocksSymbols.model
    );
    blockLogic = initializer.appManager.container.get(Symbols.logic.block);
  });
  afterEach(async function() {
    this.timeout(500 * blocksModule.lastBlock.height);
    await initializer.rawDeleteBlocks(blocksModule.lastBlock.height - 1);
  });

  describe('txs', () => {
    describe('send', () => {
      it('should not allow spending all the money the account have (fees)', async () => {
        const tx = await createSendTransactionV1(1, funds, senderAccount, '1R');
        // Blocks should be forged anyway
        expect(blocksModule.lastBlock.height).is.eq(3);
        // txmodule should not find it in db
        await expect(txModule.getByID(tx.id)).to.be.rejectedWith(
          'Transaction not found'
        );
        // Tx pool should not have it in pool
        expect(txPool.transactionInPool(tx.id)).is.false;
      });
      it('should allow spending all money without fee', async () => {
        const tx = await createSendTransactionV1(
          1,
          BigInt(funds) - systemModule.getFees().fees.send,
          senderAccount,
          '1R'
        );
        expect(blocksModule.lastBlock.height).is.eq(3);

        // txmodule should be in db with correct blockId
        const dbTX = await txModule.getByID(tx.id);
        expect(dbTX.id).to.be.deep.eq(tx.id);
        expect(dbTX.blockId).to.be.eq(blocksModule.lastBlock.id);

        // Tx pool should not have it in pool
        expect(txPool.transactionInPool(tx.id)).is.false;
      });

      it('should not allow block with tx exceeding account balance', async () => {
        const preHeight = blocksModule.lastBlock.height;
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        const txs = await Promise.all(
          new Array(3)
            .fill(null)
            .map(() =>
              createSendTransactionV1(
                0,
                Math.ceil(funds / 3),
                senderAccount,
                createRandomWallet().address
              )
            )
        );
        //const s = initializer.appManager.container.get<Sequelize>(Symbols.generic.sequelize);
        // s.options.logging = true;
        //console.log('TXS:', txs.map(tx => tx.id), senderAccount.address);

        await expect(
          initializer.rawMineBlockWithTxs(txs.map((t) => toNativeTx(t)))
        ).to.rejectedWith(/Account does not have enough currency/);
        // s.options.logging = false;

        const postAcc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(postAcc.balance).eq(acc.balance);
        expect(postAcc.u_balance).eq(acc.u_balance);
        expect(blocksModule.lastBlock.height).to.be.eq(preHeight);
      });
    });

    describe('votes', () => {
      it('should not be allowed to vote for 2 different account in same block', async () => {
        const delegate1 = getRandomDelegateWallet();
        const delegate2 = getRandomDelegateWallet();
        const txs = [
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate1.publicKey,
            true
          ),
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate2.publicKey,
            true
          ),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to vote for same account in same block', async () => {
        const delegate = getRandomDelegateWallet();
        const txs = [
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            true,
            { timestamp: 1 }
          ),
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            true
          ),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to vote/unvote within same block', async () => {
        const delegate = getRandomDelegateWallet();
        const txs = [
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            true
          ),
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            false
          ),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions[0].id).to.be.eq(txs[0].id);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to unvote something that was not voted in', async () => {
        const delegate = getRandomDelegateWallet();
        await createVoteTransactionV1(
          1,
          senderAccount,
          delegate.publicKey,
          false
        );
        expect(blocksModule.lastBlock.height).to.be.eq(3);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(0);
      });

      it('should be allowed add and then remove vote. (correctly with db reflecting data state.)', async () => {
        const delegate = getRandomDelegateWallet();
        // Add vote
        await createVoteTransactionV1(
          1,
          senderAccount,
          delegate.publicKey,
          true
        );
        let acc = await accModule.getAccount({
          address: senderAccount.address,
        });

        let delegAcc = await accModule.getAccount({
          address: delegate.address,
        });
        expect(acc.delegates).to.deep.eq([delegAcc.username]);

        // Remove vote
        await createVoteTransactionV1(
          1,
          senderAccount,
          delegate.publicKey,
          false
        );
        acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.delegates).is.deep.eq([]);
        expect(blocksModule.lastBlock.height).to.be.eq(4);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
      });

      it('should not be allowed to add & remove within same transaction (user did not confirmed vote)', async () => {
        const delegate = getRandomDelegateWallet();
        // Add vote
        await createVoteTransactionV1(
          1,
          senderAccount,
          delegate.publicKey,
          true,
          {
            preferences: [
              {
                action: '+',
                delegateIdentifier: delegate.publicKey.toString('hex'),
              },
              {
                action: '-',
                delegateIdentifier: delegate.publicKey.toString('hex'),
              },
            ],
          }
        );

        // Account should show no delegate.
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.delegates).is.deep.eq([]);

        expect(blocksModule.lastBlock.transactions).is.empty;
      });

      it('should not be allowed to remove and readd vote in same tx', async () => {
        const delegate = getRandomDelegateWallet();

        await createVoteTransactionV1(
          1,
          senderAccount,
          delegate.publicKey,
          true
        );
        // remove and readd
        await createVoteTransactionV1(
          1,
          senderAccount,
          delegate.publicKey,
          true,
          {
            asset: {
              votes: [`-${delegate.publicKey}`, `+${delegate.publicKey}`],
            },
          }
        );

        let delegAcc = await accModule.getAccount({
          address: delegate.address,
        });

        // Account should show delegate.
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.delegates).to.deep.eq([delegAcc.username]);

        // Tx should not be included
        expect(blocksModule.lastBlock.transactions).is.empty;
        expect(blocksModule.lastBlock.height).is.eq(4);
      });
    });

    describe('delegate', () => {
      it('should allow registering a delegate', async () => {
        await createRegDelegateTransactionV1(1, senderAccount, 'vekexasia');
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.username).is.eq('vekexasia');
      });
      it('should not allow delegate name with empty name', async () => {
        await createRegDelegateTransactionV1(1, senderAccount, '');
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow delegate registration with strange chars', async () => {
        await createRegDelegateTransactionV1(1, senderAccount, ':)');
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow delegate name longer than 20 chars', async () => {
        await createRegDelegateTransactionV1(
          1,
          senderAccount,
          'aaaaaaaaaaaaaaaaaaaaa'
        );
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow addressLike delegate', async () => {
        await createRegDelegateTransactionV1(
          1,
          senderAccount,
          senderAccount.address.substr(10)
        );
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow 2 accounts with same delegate name', async () => {
        await createRegDelegateTransactionV1(1, senderAccount, 'vekexasia');
        const { wallet } = await createRandomAccountWithFunds(funds);
        await createRegDelegateTransactionV1(1, wallet, 'vekexasia');
        let acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.username).is.eq('vekexasia');

        // Second account should not have same name
        acc = await accModule.getAccount({ address: wallet.address });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow same account 2 delegate registrations', async () => {
        await createRegDelegateTransactionV1(1, senderAccount, 'vekexasia');
        await createRegDelegateTransactionV1(1, senderAccount, 'meow');
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.username).is.eq('vekexasia');

        expect(await accModule.getAccount({ username: 'meow' })).is.undefined;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow same account 2 delegate within same block', async () => {
        const txs = [
          await createRegDelegateTransactionV1(0, senderAccount, 'vekexasia'),
          await createRegDelegateTransactionV1(0, senderAccount, 'meow'),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);

        expect(blocksModule.lastBlock.transactions.length).eq(1);
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.username).is.eq('vekexasia');

        expect(await accModule.getAccount({ username: 'meow' })).is.undefined;
        expect(blocksModule.lastBlock.transactions.length).is.eq(1);

        // PoolManager should kill the invalid transaction now.
        await txPoolManager.processPool();
        // Both transactions should not be in pool
        expect(txModule.transactionInPool(txs[1].id)).is.false;
        expect(txModule.transactionInPool(txs[0].id)).is.false;
      });
    });

    describe('secondSignature', () => {
      it('should allow secondSignature creation', async () => {
        const pk = createRandomWallet().publicKey;
        const tx = await createSecondSignTransactionV1(1, senderAccount, pk);
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.secondPublicKey).to.be.deep.eq(pk);
        expect(acc.secondSignature).to.be.eq(1);
      });
      it('should not allow 2 second signature in 2 diff blocks', async () => {
        const pk = createRandomWallet().publicKey;
        const pk2 = createRandomWallet().publicKey;
        const tx = await createSecondSignTransactionV1(1, senderAccount, pk);
        const tx2 = await createSecondSignTransactionV1(1, senderAccount, pk2);
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.secondPublicKey).to.be.deep.eq(pk);
        expect(acc.secondSignature).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow 2 second signature in same block', async () => {
        const pk = createRandomWallet().publicKey;
        const pk2 = createRandomWallet().publicKey;
        const txs = [
          await createSecondSignTransactionV1(0, senderAccount, pk),
          await createSecondSignTransactionV1(0, senderAccount, pk2),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).eq(1);
        await txPoolManager.processPool();

        // Check that all transactions are not in pool right now (either cause they were included in block or rejected
        for (let tx of txs) {
          expect(txPool.transactionInPool(tx.id)).is.false;
        }

        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.secondPublicKey).to.be.deep.eq(pk);
        expect(acc.secondSignature).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions.length).is.eq(1);
      });
    });
  });

  describe('other tests', () => {
    it('transactions/blocks concurrency test 1', async function() {
      this.timeout(1230000);
      /**
       * Tests applyUnconfirmed/undo when receiving blocks and transactions
       * asynchronously.
       */

      const fieldheader = {
        nethash:
          'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
        version: '0.1.10',
        port: 1,
      };

      const startHeight = blocksModule.lastBlock.height;
      const fundPerTx = 1n;

      // Create some 1 satoshi transactions
      const txs = await Promise.all(
        new Array(1000)
          .fill(null)
          .map((what, idx) =>
            createSendTransactionV1(0, fundPerTx, senderAccount, '1R', idx)
          )
      );

      await txPoolManager.processPool();
      const total = 900;
      for (let i = 0; i < total; i++) {
        if (i % ((total / 10) | 0) === 0) {
          console.log('Done', i);
        }
        const curTx = txs.slice(25 + i, 25 + i + 1)[0];
        const nextTx = txs.slice(25 + i + 1, 25 + i + 2)[0];
        const block = await initializer.generateBlock([curTx]);

        await Promise.all([
          wait(Math.random() * 50).then(() =>
            enqueueAndProcessTransactions([nextTx])
          ),
          // Broadcast block with current transaction
          wait(Math.random() * 50).then(() => initializer.postBlock(block)),
        ]);

        expect(blocksModule.lastBlock.blockSignature).to.be.deep.eq(
          block.blockSignature
        );

        // Next TX should be in pool we ensure it gets processed by refilling pool
        expect(txModule.transactionInPool(nextTx.id)).true;
        await txPoolManager.processPool();
        expect(txPool.unconfirmed.has(nextTx.id)).true;

        // Check balances are correct so that no other applyUnconfirmed happened.
        // NOTE: this could fail as <<<--HERE-->>> an applyUnconfirmed (of NEXT tx) could
        // have happened
        const { u_balance, balance } = await accModule.getAccount({
          address: senderAccount.address,
        });
        // console.log('End loop - test begins');
        expect(balance.toString()).to.be.eq(
          `${BigInt(funds) -
            fundPerTx * (BigInt(i) + 1n) -
            systemModule.getFees().fees.send * (BigInt(i) + 1n)}`,
          'confirmed balance'
        );

        expect(`${u_balance}`).to.be.eq(
          `${BigInt(
            Math.max(
              0,
              parseInt(
                (
                  BigInt(funds) -
                  fundPerTx * (BigInt(i) + 1n + 1n) -
                  systemModule.getFees().fees.send * (BigInt(i) + 1n + 1n)
                ).toString()
              )
            )
          )}`,
          'unconfirmed balance'
        );

        expect(blocksModule.lastBlock.height).to.be.eq(startHeight + i + 1);
        // console.log('Current Balance is : ', balance, u_balance);
      }

      await initializer.rawMineBlocks(1);
      const { u_balance, balance } = await accModule.getAccount({
        address: senderAccount.address,
      });
      expect(`${u_balance}`).to.be.eq(`${balance}`, 'unconfirmed balance');
    });
    it('transactions/blocks concurrency test 2', async function() {
      this.timeout(1230000);
      /**
       * This test is similar to #1 above with the only difference that
       * instead of sending the "next block" tx we send the current block tx
       * in the hope that a dual applyUnconfirmed gets done causing inconsistency.
       */

      const startHeight = blocksModule.lastBlock.height;
      const fundPerTx = 1n;

      // Create some 1 satoshi transactions
      const txs = await Promise.all(
        new Array(1000)
          .fill(null)
          .map((what, idx) =>
            createSendTransactionV1(0, fundPerTx, senderAccount, '1R', idx)
          )
      );

      const total = 1000;
      for (let i = 0; i < total; i++) {
        const block = await initializer.generateBlock(txs.slice(i, i + 1));
        if (i % ((total / 10) | 0) === 0) {
          console.log('Done', i);
        }

        await Promise.all([
          // simulate fillPool (forgeModule calling it)
          // wait(Math.random() * 100).then(() => jobsQueue.bau['delegatesNextForge']()),
          // Broadcast block with current transaction
          wait(Math.random() * 50).then(() =>
            initializer.postBlock(block, 'p2p')
          ),
          // Send the current (same) transaction
          wait(Math.random() * 50).then(() =>
            enqueueAndProcessTransactions(txs.slice(i, i + 1))
          ),
        ]);

        expect(blocksModule.lastBlock.blockSignature).to.be.deep.eq(
          block.blockSignature
        );

        // expect(txModule.getMergedTransactionList().length).is.eq(0);
        // Check balances are correct so that no other applyUnconfirmed happened.
        // NOTE: this could fail as <<<--HERE-->>> an applyUnconfirmed (of NEXT tx) could
        // have happened
        const { u_balance, balance } = await accModule.getAccount({
          address: senderAccount.address,
        });
        // console.log('End loop - test begins');
        expect(`${balance}`).to.be.eq(
          `${BigInt(funds) -
            fundPerTx * BigInt(i + 1) -
            systemModule.getFees().fees.send * BigInt(i + 1)}`,
          'confirmed balance'
        );

        expect(`${u_balance}`).to.be.eq(`${balance}`, 'unconfirmed balance');

        expect(blocksModule.lastBlock.height).to.be.eq(startHeight + i + 1);
        // console.log('Current Balance is : ', balance, u_balance);
      }

      await initializer.rawMineBlocks(1);
      const { u_balance, balance } = await accModule.getAccount({
        address: senderAccount.address,
      });
      expect(u_balance).to.be.eq(balance, 'unconfirmed balance');
    });
  });

});
