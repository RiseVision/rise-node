// tslint:disable
import 'reflect-metadata';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline';
import * as supertest from 'supertest';
import { ITransactionLogic, ITransactionPoolLogic } from '../../src/ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule,
  ISystemModule,
  ITransactionsModule,
  ITransportModule
} from '../../src/ioc/interfaces/modules';
import { Symbols } from '../../src/ioc/symbols';
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
  getRandomDelegateWallet
} from './common/utils';
import { Ed, JobsQueue, wait } from '../../src/helpers';
import BigNumber from 'bignumber.js';
import { toBufferedTransaction } from '../utils/txCrafter';
import { BlocksModel } from '../../src/models';

// tslint:disable no-unused-expression
chai.use(chaiAsPromised);
describe('highlevel checks', function () {
  this.timeout(10000);
  const funds = Math.pow(10, 11);
  let senderAccount: LiskWallet;
  initializer.setup();
  let blocksModule: IBlocksModule;
  let accModule: IAccountsModule;
  let txModule: ITransactionsModule;
  let txPool: ITransactionPoolLogic;
  let transportModule: ITransportModule;
  let txLogic: ITransactionLogic;
  let systemModule: ISystemModule;
  let ed: Ed;
  beforeEach(async () => {
    const {wallet: randomAccount} = await createRandomAccountWithFunds(funds);
    senderAccount                 = randomAccount;
    ed                            = initializer.appManager.container.get(Symbols.helpers.ed);
    blocksModule                  = initializer.appManager.container.get(Symbols.modules.blocks);
    accModule                     = initializer.appManager.container.get(Symbols.modules.accounts);
    txModule                      = initializer.appManager.container.get(Symbols.modules.transactions);
    transportModule               = initializer.appManager.container.get(Symbols.modules.transport);
    txPool                        = initializer.appManager.container.get(Symbols.logic.transactionPool);
    txLogic                       = initializer.appManager.container.get(Symbols.logic.transaction);
    systemModule                  = initializer.appManager.container.get(Symbols.modules.system);
  });
  afterEach(async function () {
    this.timeout(100000);
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
console.log('bit');
        const tx = await createSendTransaction(1, funds - systemModule.getFees().fees.send, senderAccount, '1R');
        expect(blocksModule.lastBlock.height).is.eq(3);

        // txmodule should be in db with correct blockId
        const dbTX = await txModule.getByID(tx.id);
        expect(dbTX.id).to.be.deep.eq(tx.id);
        expect(dbTX.blockId).to.be.eq(blocksModule.lastBlock.id);

        // Tx pool should not have it in pool
        expect(txPool.transactionInPool(tx.id)).is.false;
      });

      it('should not include one of the tx exceeding account balance', async () => {
        const txs = await Promise.all(
          new Array(3).fill(null)
            .map(() => createSendTransaction(
              0,
              Math.ceil(funds / 3), senderAccount,
              createRandomWallet().address
              )
            )
        );
        await txModule.receiveTransactions(txs
          .map((tx) => toBufferedTransaction(tx)),
          false,
          false
        );
        await initializer.rawMineBlocks(1);

        expect(blocksModule.lastBlock.transactions.length).to.be.eq(2);
        // All of the transactions should not in pool anymore.
        for (const stx of txs) {
          expect(await txPool.transactionInPool(stx.id)).to.be.false;
        }
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
        await txModule.receiveTransactions(txs.map((t) => toBufferedTransaction(t)), false, false);
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
        await txModule.receiveTransactions(txs.map((t) => toBufferedTransaction(t)), false, false);
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
        try {
          await txModule.receiveTransactions(txs.map((t) => toBufferedTransaction(t)), false, false);
        } catch (e) {
          void 0;
        }
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

        await txModule.receiveTransactions(txs.map((t) => toBufferedTransaction(t)), false, false);
        await initializer.rawMineBlocks(1);
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.username).is.eq('meow');

        expect(await accModule.getAccount({username: 'vekexasia'})).is.undefined;
        expect(blocksModule.lastBlock.transactions.length).is.eq(1);
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
        await confirmTransactions(txs, 1);
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.secondPublicKey.toString('hex')).to.be.eq(pk2);
        expect(acc.secondSignature).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions.length).is.eq(1);
      });
    });

    describe('multiSignature', () => {
      it('should create multisignature account', async () => {
        const keys     = new Array(3).fill(null).map(() => createRandomWallet());
        const signedTx = toBufferedTransaction(
          createMultiSignTransaction(senderAccount, 3, keys.map((k) => `+${k.publicKey}`))
        );
        await txModule.receiveTransactions([signedTx], false, false);
        await initializer.rawMineBlocks(1);
        // In pool => valid and not included in block.
        expect(txPool.multisignature.has(signedTx.id)).is.true;
        // let it sign by all.

        const signatures = keys.map((k) => ed.sign(
          txLogic.getHash(signedTx, true, false),
          {
            privateKey: Buffer.from(k.privKey, 'hex'),
            publicKey : Buffer.from(k.publicKey, 'hex'),
          }
        ).toString('hex'));

        await transportModule.receiveSignatures(signatures.map((sig) => ({
          signature  : sig,
          transaction: signedTx.id,
        })));

        await initializer.rawMineBlocks(1);

        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.multisignatures).to.be.an('array');

        for (const k of keys) {
          expect(acc.multisignatures).to.contain(k.publicKey);
        }
        expect(acc.multimin).to.be.eq(3);
        expect(acc.multilifetime).to.be.eq(24);
      });
      it('should not allow min > than keys', async () => {
        const keys     = new Array(3).fill(null).map(() => createRandomWallet());
        const signedTx = toBufferedTransaction(
          createMultiSignTransaction(senderAccount, 4, keys.map((k) => `+${k.publicKey}`))
        );
        return expect(txModule.receiveTransactions([signedTx], false, false)).to.be
          .rejectedWith('Invalid multisignature min. Must be less than or equal to keysgroup size');
      });
      it('should keep tx in multisignature tx pool until all signature arrives, even if min is 2', async () => {
        const keys     = new Array(3).fill(null).map(() => createRandomWallet());
        const signedTx = toBufferedTransaction(
          createMultiSignTransaction(senderAccount, 2, keys.map((k) => `+${k.publicKey}`))
        );
        await txModule.receiveTransactions([signedTx], false, false);
        await initializer.rawMineBlocks(1);
        // In pool => valid and not included in block.
        expect(txPool.multisignature.has(signedTx.id)).is.true;

        // let it sign by all.
        const signatures = keys.map((k) => ed.sign(
          txLogic.getHash(signedTx, true, false),
          {
            privateKey: Buffer.from(k.privKey, 'hex'),
            publicKey : Buffer.from(k.publicKey, 'hex'),
          }
        ).toString('hex'));

        for (let i = 0; i < signatures.length - 1; i++) {
          await transportModule.receiveSignatures([{
            signature  : signatures[i],
            transaction: signedTx.id,
          }]);
          await initializer.rawMineBlocks(1);
          const acc = await accModule.getAccount({address: senderAccount.address});
          expect(acc.multisignatures).to.be.null;
          expect(txPool.multisignature.has(signedTx.id)).is.true;
        }
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
        new Array(10000).fill(null)
          .map((what, idx) => createSendTransaction(0, fundPerTx, senderAccount, '1R', {timestamp: idx}))
      );

      // send to transport the txs that will be in bundled
      await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(fieldheader)
        .send({transactions: txs.slice(0, 2)})
        .expect(200);

      await txPool.processBundled();
      await txModule.fillPool();
      for (let i = 0; i < 25; i++) {
        const block = await initializer.generateBlock(txs.slice(25 + i, 25 + i + 1));
        //console.log (`####`);
        //console.log (`LOOP ${i} Adding ${txs.slice(25 + i)[0].id}`);
        //console.log (`####`);

        // Send the NEXT transaction (next block) (non bundled)
        wait(Math.random() * 100)
          .then(() => supertest(initializer.appManager.expressApp)
          .post('/peer/transactions')
          .set(fieldheader)
          .send({transaction: txs.slice(25 + i + 1, 25 + i + 2)[0]})
          .expect(200))
          .catch((err) => void 0 /*SILENT*/);

        // Broadcast block with current transaction
        await supertest(initializer.appManager.expressApp)
          .post('/peer/blocks')
          .set(fieldheader)
          .send({block: BlocksModel.toStringBlockType(block)})
          .expect(200);

        expect(blocksModule.lastBlock.blockSignature).to.be.deep.eq(block.blockSignature);

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
          .minus(fundPerTx * (i + 1 + 2))
          .minus(systemModule.getFees().fees.send * (i + 1 + 2))
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
      const jobsQueue = initializer.appManager.container.get<JobsQueue>(Symbols.helpers.jobsQueue);

      const fieldheader = {
        nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
        version: '0.1.10',
        port   : 1,
      };

      const startHeight = blocksModule.lastBlock.height;
      const fundPerTx = 1;

      // Create some 1 satoshi transactions
      const txs = await Promise.all(
        new Array(10000).fill(null)
          .map((what, idx) => createSendTransaction(0, fundPerTx, senderAccount, '1R', {timestamp: idx}))
      );


      for (let i = 0; i < 500; i++) {
        const block = await initializer.generateBlock(txs.slice(i, i + 1));
        console.log (`####`);
        console.log(block.transactions[0].id);
        console.log (`####`);

        // Send the current (same) transaction
        await supertest(initializer.appManager.expressApp)
            .post('/peer/transactions')
            .set(fieldheader)
            .send({transaction: txs.slice(i, i+1)[0]})
            .expect(200);


        await Promise.all([
          // simulate fillPool (forgeModule calling it)
          // wait(Math.random() * 100).then(() => jobsQueue.bau['delegatesNextForge']()),
          // Broadcast block with current transaction
          supertest(initializer.appManager.expressApp)
            .post('/peer/blocks')
            .set(fieldheader)
            .send({block: BlocksModel.toStringBlockType(block)})
            .expect(200)
        ]);

        expect(blocksModule.lastBlock.blockSignature).to.be.deep.eq(block.blockSignature);

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
          .minus(fundPerTx * (i + 1))
          .minus(systemModule.getFees().fees.send * (i + 1))
          .toNumber()), 'unconfirmed balance');

        expect(blocksModule.lastBlock.height).to.be.eq( startHeight + i + 1);
        // console.log('Current Balance is : ', balance, u_balance);
      }

      await initializer.rawMineBlocks(1);
      const {u_balance, balance} = await accModule.getAccount({address: senderAccount.address});
      expect(u_balance).to.be.eq(balance, 'unconfirmed balance');
    });
  });
});
