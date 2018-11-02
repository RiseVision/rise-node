// tslint:disable
import 'reflect-metadata';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline';
import * as supertest from 'supertest';
import initializer from './common/init';
import {
  confirmTransactions,
  createMultiSignTransaction,
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransaction,
  createSecondSignTransaction,
  createSendTransaction,
  createVoteTransaction,
  easyCreateMultiSignAccount,
  enqueueAndProcessTransactions,
  getRandomDelegateWallet, getSelfTransportPeer,
} from './common/utils';
import BigNumber from 'bignumber.js';
import { Sequelize } from 'sequelize-typescript';
import { BlockLogic, BlocksModel, BlocksModule, BlocksSymbols } from '@risevision/core-blocks';
import {
  TransactionLogic,
  TransactionPool,
  TransactionsModel,
  TransactionsModule, TXSymbols
} from '@risevision/core-transactions';
import { wait } from '@risevision/core-utils';
import { AccountsModule, AccountsSymbols } from '@risevision/core-accounts';
import { SystemModule } from '@risevision/core';
import { IBytesBlock } from '@risevision/core-types';
import { toBufferedTransaction } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { IAccountsModule, Symbols } from '@risevision/core-interfaces';
import { TransportModule } from '@risevision/core-p2p';
import { Crypto } from '@risevision/core-helpers';
import { p2pSymbols } from '@risevision/core-p2p';
import { ModelSymbols } from '@risevision/core-models';
import { AccountsModelForDPOS } from '@risevision/core-consensus-dpos';
import { AccountsModelWith2ndSign } from '@risevision/core-secondsignature';
import {
  AccountsModelWithMultisig,
  MultisigSymbols,
  PostSignaturesRequest
} from '@risevision/core-multisignature';
import { PoolManager } from '@risevision/core-transactions';

// tslint:disable no-unused-expression
chai.use(chaiAsPromised);
describe('highlevel checks', function () {
  this.timeout(10000);
  const funds = Math.pow(10, 11);
  let senderAccount: LiskWallet;
  initializer.setup();
  let blockLogic: BlockLogic;
  let blocksModule: BlocksModule;
  let accModule: IAccountsModule<AccountsModelForDPOS & AccountsModelWith2ndSign & AccountsModelWithMultisig>;
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
    const {wallet: randomAccount} = await createRandomAccountWithFunds(funds);
    senderAccount                 = randomAccount;
    ed                            = initializer.appManager.container.get(Symbols.generic.crypto);
    blocksModule                  = initializer.appManager.container.get(BlocksSymbols.modules.blocks);
    accModule                     = initializer.appManager.container.get(AccountsSymbols.module);
    txModule                      = initializer.appManager.container.get(TXSymbols.module);
    transportModule               = initializer.appManager.container.get(p2pSymbols.modules.transport);
    txPool                        = initializer.appManager.container.get(TXSymbols.pool);
    txLogic                       = initializer.appManager.container.get(TXSymbols.logic);
    systemModule                  = initializer.appManager.container.get(Symbols.modules.system);
    txPoolManager                 = initializer.appManager.container.get(TXSymbols.poolManager);
    txModel                       = initializer.appManager.container.getNamed(ModelSymbols.model, TXSymbols.model);
    blocksModel                   = initializer.appManager.container.getNamed(ModelSymbols.model, BlocksSymbols.model);
    blockLogic                    = initializer.appManager.container.get(Symbols.logic.block);
  });
  afterEach(async function () {
    this.timeout(500 * blocksModule.lastBlock.height);
    await initializer.rawDeleteBlocks(blocksModule.lastBlock.height - 1);
  });

  describe('txs', () => {

    describe('send', () => {
      it('should not allow spending all the money the account have (fees)', async () => {
        const tx = await createSendTransaction(1, funds, senderAccount, '1R');
        // Blocks should be forged anyway
        expect(blocksModule.lastBlock.height).is.eq(3);
        // txmodule should not find it in db
        await expect(txModule.getByID(tx.id)).to.be.rejectedWith('Transaction not found');
        // Tx pool should not have it in pool
        expect(txPool.transactionInPool(tx.id)).is.false;
      });
      it('should allow spending all money without fee', async () => {
        const tx = await createSendTransaction(1, funds - systemModule.getFees().fees.send, senderAccount, '1R');
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
        const acc = await accModule.getAccount({address: senderAccount.address});
        const txs = await Promise.all(
          new Array(3).fill(null)
            .map(() => createSendTransaction(
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

        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t))))
          .to
          .rejectedWith(/Account does not have enough currency/);
        // s.options.logging = false;

        const postAcc = await accModule.getAccount({address: senderAccount.address });
        expect(postAcc.balance).eq(acc.balance);
        expect(postAcc.u_balance).eq(acc.u_balance);
        expect(blocksModule.lastBlock.height).to.be.eq(preHeight);
      });
    });

    describe('votes', () => {
      it('should not be allowed to vote for 2 different account in same block', async () => {
        const delegate1 = getRandomDelegateWallet();
        const delegate2 = getRandomDelegateWallet();
        const txs       = [
          await createVoteTransaction(0, senderAccount, delegate1.publicKey, true),
          await createVoteTransaction(0, senderAccount, delegate2.publicKey, true),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to vote for same account in same block', async () => {
        const delegate = getRandomDelegateWallet();
        const txs      = [
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true, {timestamp: 1}),
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to vote/unvote within same block', async () => {
        const delegate = getRandomDelegateWallet();
        const txs      = [
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true),
          await createVoteTransaction(0, senderAccount, delegate.publicKey, false),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions[0].id).to.be.eq(txs[0].id);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to unvote something that was not voted in', async () => {
        const delegate = getRandomDelegateWallet();
        await createVoteTransaction(1, senderAccount, delegate.publicKey, false);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(0);
      });

      it('should be allowed add and then remove vote. (correctly with db reflecting data state.)', async () => {
        const delegate = getRandomDelegateWallet();
        // Add vote
        await createVoteTransaction(1, senderAccount, delegate.publicKey, true);
        let acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.delegates).to.contain(delegate.publicKey);

        // Remove vote
        await createVoteTransaction(1, senderAccount, delegate.publicKey, false);
        acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.delegates).is.null;
        expect(blocksModule.lastBlock.height).to.be.eq(4);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
      });

      it('should not be allowed to add & remove within same transaction (user did not confirmed vote)', async () => {
        const delegate = getRandomDelegateWallet();
        // Add vote
        await createVoteTransaction(1, senderAccount, delegate.publicKey, true, {
          asset: {
            votes: [
              `+${delegate.publicKey}`,
              `-${delegate.publicKey}`,
            ],
          },
        });

        // Account should show no delegate.
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.delegates).is.null;

        expect(blocksModule.lastBlock.transactions).is.empty;
      });

      it('should not be allowed to remove and readd vote in same tx', async () => {
        const delegate = getRandomDelegateWallet();

        await createVoteTransaction(1, senderAccount, delegate.publicKey, true);
        // remove and readd
        await createVoteTransaction(1, senderAccount, delegate.publicKey, true, {
          asset: {
            votes: [
              `-${delegate.publicKey}`,
              `+${delegate.publicKey}`,
            ],
          },
        });

        // Account should show delegate.
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.delegates).to.contain(delegate.publicKey);

        // Tx should not be included
        expect(blocksModule.lastBlock.transactions).is.empty;
        expect(blocksModule.lastBlock.height).is.eq(4);
      });
    });

    describe('delegate', () => {
      it('should allow registering a delegate', async () => {
        await createRegDelegateTransaction(1, senderAccount, 'vekexasia');
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.eq('vekexasia');
      });
      it('should not allow delegate name with empty name', async () => {
        await createRegDelegateTransaction(1, senderAccount, '');
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow delegate registration with strange chars', async () => {
        await createRegDelegateTransaction(1, senderAccount, ':)');
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow delegate name longer than 20 chars', async () => {
        await createRegDelegateTransaction(1, senderAccount, 'aaaaaaaaaaaaaaaaaaaaa');
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow addressLike delegate', async () => {
        await createRegDelegateTransaction(1, senderAccount, senderAccount.address.substr(10));
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow 2 accounts with same delegate name', async () => {
        await createRegDelegateTransaction(1, senderAccount, 'vekexasia');
        const {wallet} = await createRandomAccountWithFunds(funds);
        await createRegDelegateTransaction(1, wallet, 'vekexasia');
        let acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.eq('vekexasia');

        // Second account should not have same name
        acc = await accModule.getAccount({address: wallet.address});
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow same account 2 delegate registrations', async () => {
        await createRegDelegateTransaction(1, senderAccount, 'vekexasia');
        await createRegDelegateTransaction(1, senderAccount, 'meow');
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.eq('vekexasia');

        expect(await accModule.getAccount({username: 'meow'})).is.undefined;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow same account 2 delegate within same block', async () => {
        const txs = [
          await createRegDelegateTransaction(0, senderAccount, 'vekexasia'),
          await createRegDelegateTransaction(0, senderAccount, 'meow'),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);

        expect(blocksModule.lastBlock.transactions.length).eq(1);
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.eq('vekexasia');

        expect(await accModule.getAccount({username: 'meow'})).is.undefined;
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
        const pk  = createRandomWallet().publicKey;
        const tx  = await createSecondSignTransaction(1, senderAccount, pk);
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.secondPublicKey.toString('hex')).to.be.eq(pk);
        expect(acc.secondSignature).to.be.eq(1);
      });
      it('should not allow 2 second signature in 2 diff blocks', async () => {
        const pk  = createRandomWallet().publicKey;
        const pk2 = createRandomWallet().publicKey;
        const tx  = await createSecondSignTransaction(1, senderAccount, pk);
        const tx2 = await createSecondSignTransaction(1, senderAccount, pk2);
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.secondPublicKey.toString('hex')).to.be.eq(pk);
        expect(acc.secondSignature).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow 2 second signature in same block', async () => {
        const pk  = createRandomWallet().publicKey;
        const pk2 = createRandomWallet().publicKey;
        const txs = [
          await createSecondSignTransaction(0, senderAccount, pk),
          await createSecondSignTransaction(0, senderAccount, pk2),
        ];
        await enqueueAndProcessTransactions(txs);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).eq(1);
        await txPoolManager.processPool();

        // Check that all transactions are not in pool right now (either cause they were included in block or rejected
        for (let tx of txs) {
          expect(txPool.transactionInPool(tx.id)).is.false;
        }

        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.secondPublicKey.toString('hex')).to.be.eq(pk);
        expect(acc.secondSignature).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions.length).is.eq(1);
      });
    });

    describe('multiSignature', () => {
      let postsignRequest: PostSignaturesRequest;
      beforeEach(async () => {
        postsignRequest = initializer.appManager
          .container.getNamed(p2pSymbols.transportMethod, MultisigSymbols.p2p.postSignatures);
      });

      it('should create multisignature account', async () => {
        const {keys, wallet, tx} = await easyCreateMultiSignAccount(3, 3);

        const acc = await accModule.getAccount({address: wallet.address});
        expect(acc.multisignatures).to.be.an('array');

        for (const k of keys) {
          expect(acc.multisignatures).to.contain(k.publicKey);
        }
        expect(acc.multimin).to.be.eq(3);
        expect(acc.multilifetime).to.be.eq(24);
      });
      it('should not allow min > than keys', async () => {
        const keys     = new Array(3).fill(null).map(() => createRandomWallet());
        const signedTx = createMultiSignTransaction(senderAccount, 4, keys.map((k) => `+${k.publicKey}`));
        await enqueueAndProcessTransactions([signedTx]);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).eq(0);

        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.isMultisignature()).is.false;

        await txPoolManager.processPool();
        expect(txPool.transactionInPool(signedTx.id)).is.false;
        //return expect(txModule.processUnconfirmedTransaction(signedTx, false, false)).to.be
        //  .rejectedWith('Invalid multisignature min. Must be less than or equal to keysgroup size');
      });
      it('should keep tx in multisignature tx pool until all signature arrives, even if min is 2', async () => {
        const keys     = new Array(3).fill(null).map(() => createRandomWallet());
        const signedTx = toBufferedTransaction(
          createMultiSignTransaction(senderAccount, 2, keys.map((k) => `+${k.publicKey}`))
        );
        await txModule.processIncomingTransactions([signedTx], null);
        await txPoolManager.processPool();
        await initializer.rawMineBlocks(1);
        // In pool => valid and not included in block.
        expect(txPool.pending.has(signedTx.id)).is.true;

        // let it sign by all.
        const signatures = keys.map((k) => ed.sign(
          txLogic.getHash(signedTx, false, false),
          {
            privateKey: Buffer.from(k.privKey, 'hex'),
            publicKey : Buffer.from(k.publicKey, 'hex'),
          }
        ));

        const selfPeer = getSelfTransportPeer();
        for (let i = 0; i < signatures.length - 1; i++) {
          await selfPeer.makeRequest(postsignRequest, {
            body: {
              signatures: [{
                signature: signatures[i],
                transaction: signedTx.id,
                relays: 3,
              }]
            }
          });
          await txPoolManager.processPool();
          await initializer.rawMineBlocks(1);
          const acc = await accModule.getAccount({address: senderAccount.address});
          expect(acc.multisignatures).to.be.null;
          expect(txPool.pending.has(signedTx.id)).is.true;
        }

        //Lets confirm account
        await selfPeer.makeRequest(postsignRequest, {
          body: {
            signatures: [{
              signature  : signatures[signatures.length-1],
              transaction: signedTx.id,
              relays: 3,
            }]
          }
        });
        await txPoolManager.processPool();

        await initializer.rawMineBlocks(1);
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.multisignatures).to.not.be.null;
        expect(acc.isMultisignature()).is.true;
        expect(txPool.pending.has(signedTx.id)).is.false;

      });
    });

    describe('edge-cases', () => {
      it('should react correctly when tx seems to belong to multisignature account while account is not multisign', async () => {
        const tx = await createSendTransaction(1, funds, senderAccount, '1R', {requesterPublicKey: senderAccount.publicKey});
        // Blocks should be forged anyway
        expect(blocksModule.lastBlock.height).is.eq(3);
        // txmodule should not find it in db
        await expect(txModule.getByID(tx.id)).to.be.rejectedWith('Transaction not found');
        // Tx pool should not have it in pool
        expect(txPool.transactionInPool(tx.id)).is.false;
      });
    })
  });

  describe('other tests', () => {
    it('transactions/blocks concurrency test 1', async function () {
      this.timeout(1230000);
      /**
       * Tests applyUnconfirmed/undo when receiving blocks and transactions
       * asynchronously.
       */


      const fieldheader = {
        nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
        version: '0.1.10',
        port   : 1,
      };

      const startHeight = blocksModule.lastBlock.height;
      const fundPerTx = 1;

      // Create some 1 satoshi transactions
      const txs = await Promise.all(
        new Array(1000).fill(null)
          .map((what, idx) => createSendTransaction(0, fundPerTx, senderAccount, '1R', {timestamp: idx}))
      );

      await txPoolManager.processPool();
      const total = 900;
      for (let i = 0; i < total; i++) {
        if (i % (total / 10 | 0) === 0) {
          console.log('Done', i);
        }
        const curTx = txs.slice(25 + i, 25 + i + 1)[0];
        const nextTx = txs.slice(25 + i + 1, 25 + i + 2)[0];
        const block = await initializer.generateBlock([curTx]);

        await Promise.all([
          wait(Math.random() * 50)
            .then(() => enqueueAndProcessTransactions([nextTx])),
          // Broadcast block with current transaction
          wait(Math.random() * 50)
            .then(() => initializer.postBlock(block))
        ]);


        expect(blocksModule.lastBlock.blockSignature).to.be.deep.eq(block.blockSignature);

        // Next TX should be in pool we ensure it gets processed by refilling pool
        expect(txModule.transactionInPool(nextTx.id)).true;
        await txPoolManager.processPool();
        expect(txPool.unconfirmed.has(nextTx.id)).true;

        // Check balances are correct so that no other applyUnconfirmed happened.
        // NOTE: this could fail as <<<--HERE-->>> an applyUnconfirmed (of NEXT tx) could
        // have happened
        const { u_balance, balance } = await accModule.getAccount({address: senderAccount.address});
        // console.log('End loop - test begins');
        expect(new BigNumber(balance).toNumber()).to.be.eq(new BigNumber(funds)
          .minus(fundPerTx * (i + 1))
          .minus(systemModule.getFees().fees.send * (i + 1))
          .toNumber(), 'confirmed balance');

        expect(new BigNumber(u_balance).toNumber()).to.be.eq(Math.max(0, new BigNumber(funds)
          .minus(fundPerTx * (i + 1 + 1))
          .minus(systemModule.getFees().fees.send * (i + 1 + 1))
          .toNumber()), 'unconfirmed balance');

        expect(blocksModule.lastBlock.height).to.be.eq( startHeight + i + 1);
        // console.log('Current Balance is : ', balance, u_balance);
      }

      await initializer.rawMineBlocks(1);
      const {u_balance, balance} = await accModule.getAccount({address: senderAccount.address});
      expect(u_balance).to.be.eq(balance, 'unconfirmed balance');
    });
    it('transactions/blocks concurrency test 2', async function () {
      this.timeout(1230000);
      /**
       * This test is similar to #1 above with the only difference that
       * instead of sending the "next block" tx we send the current block tx
       * in the hope that a dual applyUnconfirmed gets done causing inconsistency.
       */

      const startHeight = blocksModule.lastBlock.height;
      const fundPerTx   = 1;

      // Create some 1 satoshi transactions
      const txs = await Promise.all(
        new Array(1000).fill(null)
          .map((what, idx) => createSendTransaction(0, fundPerTx, senderAccount, '1R', {timestamp: idx}))
      );

      const total = 1000;
      for (let i = 0; i < total; i++) {
        const block = await initializer.generateBlock(txs.slice(i, i + 1));
        if (i % (total / 10 | 0) === 0) {
          console.log('Done', i);
        }


        await Promise.all([
          // simulate fillPool (forgeModule calling it)
          // wait(Math.random() * 100).then(() => jobsQueue.bau['delegatesNextForge']()),
          // Broadcast block with current transaction
          wait(Math.random() * 50)
            .then(() => initializer.postBlock(block, 'p2p')),
          // Send the current (same) transaction
          wait(Math.random() * 50)
            .then(() => enqueueAndProcessTransactions(txs.slice(i, i+1)))

        ]);

        expect(blocksModule.lastBlock.blockSignature).to.be.deep.eq(block.blockSignature);

        // expect(txModule.getMergedTransactionList().length).is.eq(0);
        // Check balances are correct so that no other applyUnconfirmed happened.
        // NOTE: this could fail as <<<--HERE-->>> an applyUnconfirmed (of NEXT tx) could
        // have happened
        const {u_balance, balance} = await accModule.getAccount({address: senderAccount.address});
        // console.log('End loop - test begins');
        expect(new BigNumber(balance).toNumber()).to.be.eq(new BigNumber(funds)
          .minus(fundPerTx * (i + 1))
          .minus(systemModule.getFees().fees.send * (i + 1))
          .toNumber(), 'confirmed balance');

        expect(new BigNumber(u_balance).toNumber()).to.be.eq(new BigNumber(balance).toNumber(), 'unconfirmed balance');

        expect(blocksModule.lastBlock.height).to.be.eq(startHeight + i + 1);
        // console.log('Current Balance is : ', balance, u_balance);
      }

      await initializer.rawMineBlocks(1);
      const {u_balance, balance} = await accModule.getAccount({address: senderAccount.address});
      expect(u_balance).to.be.eq(balance, 'unconfirmed balance');
    });
  });

  // TODO: Lerna ? -> not sure why this is here.
  // describe('blockLogic / transactionLogic .fromBytes()', () => {
  //     let instance: BlockLogic;
  //     let transactions;
  //     let block;
  //     let otherAccounts;
  //     beforeEach(async () => {
  //       otherAccounts = await createRandomAccountWithFunds(123);
  //       transactions = [
  //         await createSendTransaction(1, 1, senderAccount, otherAccounts.wallet.address),
  //         await createVoteTransaction(1, senderAccount, otherAccounts.delegate.publicKey, true),
  //       ];
  //       block = await initializer.generateBlock(transactions);
  //     });
  //
  //     it('should create block and transactions identical to the original one', () => {
  //       block.transactions = transactions.map((tx) => {
  //         tx.senderPublicKey = Buffer.from(tx.senderPublicKey, 'hex');
  //         tx.signature = Buffer.from(tx.signature, 'hex');
  //         tx.height = block.height;
  //         tx.blockId = block.id;
  //         tx.relays = undefined;
  //         return tx;
  //       });
  //       block.relays = 1;
  //       const origBytes = blockLogic.getBytes(block);
  //       const bytesBlock: IBytesBlock = {
  //         bytes: origBytes as any,
  //         transactions: transactions.map((tx) => {
  //           return {
  //             bytes: txLogic.getBytes(tx) as any,
  //             hasRequesterPublicKey: typeof tx.requesterPublicKey !== 'undefined' && tx.requesterPublicKey != null,
  //             hasSignSignature: typeof tx.signSignature !== 'undefined' && tx.signSignature != null,
  //             fee: tx.fee
  //           };
  //         }),
  //         height: block.height,
  //         relays: 1
  //       };
  //       const fromBytesBlock = blockLogic.fromBytes(bytesBlock);
  //       expect(fromBytesBlock).to.be.deep.eq(block);
  //     });
  // });

  // describe('he', () => {
  //   it('bau', async function () {
  //     this.timeout(1000000)
  //     const sequelize = initializer.appManager.container.get<Sequelize>(Symbols.generic.sequelize);
  //     // sequelize.options.logging = true;
  //     // sequelize.options.benchmark = true;
  //     // await initializer.rawMineBlocks(1000);
  //     const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  //     const senderWallets = [];
  //     for (let i=0; i<25; i++) {
  //       const del = findDelegateByUsername(`genesisDelegate${i+1}`);
  //       senderWallets.push(new LiskWallet(del.secret, 'R'));
  //     }
  //
  //     const howManyPerAccount = 1000; // /10 blocchi!
  //     const txs = [];
  //     for (let i=0; i< howManyPerAccount * senderWallets.length; i++) {
  //       const t               = new dposOffline.transactions.SendTx();
  //       t.set('amount', 1);
  //       t.set('fee', systemModule.getFees().fees.send);
  //       t.set('timestamp', i);
  //       t.set('recipientId', '1R');
  //       const signedTx = t.sign(senderWallets[i%senderWallets.length]);
  //       signedTx['senderId'] = senderWallets[i%senderWallets.length].address;
  //       txs.push(signedTx);
  //     }
  //
  //     const now = Date.now();
  //     await confirmTransactions(txs, false);
  //     const took = Date.now() - now;
  //     console.log(`It Took ${took} for ${txs.length} - TPs: ${txs.length/took* 1000}`);
  //     sequelize.options.logging = false;
  //   });
  // });
});
