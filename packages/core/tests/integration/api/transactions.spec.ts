import { expect } from 'chai';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import * as supertest from 'supertest';
import initializer from '../common/init';
// tslint:disable-next-line
import { constants, TransactionType } from '../../../src/helpers';
import { ITransactionPoolLogic } from '../../../src/ioc/interfaces/logic';
import { IBlocksModule, ITransactionsModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';

import {
  createRandomAccountWithFunds, createRandomWallet, createSecondSignTransaction,
  createSendTransaction,
  createVoteTransaction,
  getRandomDelegateWallet
} from '../common/utils';
import {
  checkAddress,
  checkEnumParam,
  checkIntParam,
  checkPubKey,
  checkRequiredParam,
  checkReturnObjKeyVal
} from './utils';

import { toBufferedTransaction } from '../../utils/txCrafter';
import { Sequelize } from 'sequelize-typescript';

// tslint:disable no-unused-expression max-line-length
describe('api/transactions', () => {

  initializer.setup();

  describe('/', () => {
    // TODO: blockid and and:Blockid
    checkIntParam('and:type', '/api/transactions', {min: 0, max: 10});
    checkIntParam('type', '/api/transactions', {min: 0, max: 10});

    checkAddress('and:senderId', '/api/transactions');
    checkAddress('senderId', '/api/transactions');

    checkPubKey('and:senderPublicKey', '/api/transactions');
    checkPubKey('senderPublicKey', '/api/transactions');

    checkAddress('and:recipientId', '/api/transactions');
    checkAddress('recipientId', '/api/transactions');

    checkIntParam('and:fromHeight', '/api/transactions', {min: 1});
    checkIntParam('fromHeight', '/api/transactions', {min: 1});

    checkIntParam('and:toHeight', '/api/transactions', {min: 1});
    checkIntParam('toHeight', '/api/transactions', {min: 1});

    checkIntParam('and:fromTimestamp', '/api/transactions', {min: 0});
    checkIntParam('fromTimestamp', '/api/transactions', {min: 0});

    checkIntParam('and:toTimestamp', '/api/transactions', {min: 1});
    checkIntParam('toTimestamp', '/api/transactions', {min: 1});

    checkIntParam('and:fromUnixTime', '/api/transactions', {min: constants.epochTime.getTime() / 1000});
    checkIntParam('fromUnixTime', '/api/transactions', {min: constants.epochTime.getTime() / 1000});

    checkIntParam('and:toUnixTime', '/api/transactions', {min: constants.epochTime.getTime() / 1000});
    checkIntParam('toUnixTime', '/api/transactions', {min: constants.epochTime.getTime() / 1000});

    checkIntParam('and:minAmount', '/api/transactions', {min: 0});
    checkIntParam('minAmount', '/api/transactions', {min: 0});

    checkIntParam('and:minConfirmations', '/api/transactions', {min: 0});
    checkIntParam('minConfirmations', '/api/transactions', {min: 0});

    checkIntParam('limit', '/api/transactions', {min: 1, max: 1000});
    checkIntParam('offset', '/api/transactions', {min: 0});

    checkEnumParam(
      'orderBy',
      ['height:asc', 'height:desc', 'timestamp:asc', 'timestamp:desc', 'amount:asc', 'amount:desc'],
      '/api/transactions'
    );

    let voteTx: ITransaction<any>;
    let sendTxID: string;
    let secondSignTx: ITransaction<any>;
    let onlyReceiverTxID: string;
    let senderAccount: LiskWallet;
    let voterAccount: LiskWallet;
    let onlyReceiverAccount: LiskWallet;

    // it makes sure to remove created transactions.
    initializer.autoRestoreEach();

    beforeEach(async () => {
      senderAccount                       = getRandomDelegateWallet();
      const {wallet: randomAccount, txID} = await createRandomAccountWithFunds(Math.pow(10, 11));
      voterAccount                        = randomAccount;
      sendTxID                            = txID;

      voteTx = await createVoteTransaction(
        1,
        randomAccount,
        senderAccount.publicKey,
        true
      );

      const {wallet: rA, txID: ortid} = await createRandomAccountWithFunds(Math.pow(10, 10));
      onlyReceiverTxID                = ortid;
      onlyReceiverAccount             = rA;

      secondSignTx = await createSecondSignTransaction(
        1,
        voterAccount,
        createRandomWallet().publicKey
      );

    });

    it('should disallow an unknown query parameter', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/transactions?hey=brooother')
        .expect(200)
        .then((resp) => {
          expect(resp.body.error).to.contain('Additional properties not allowed');
        });
    });
    describe('type filter', () => {
      it('should filter only send tx', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?type=${TransactionType.SEND}&and:fromHeight=2&orderBy=height:asc`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(2);
            expect(resp.body.transactions[0].id).to.be.eq(sendTxID);
          });
      });
      it('should filter only vote tx', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?type=${TransactionType.VOTE}&and:fromHeight=2`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(voteTx.id);
            expect(resp.body.transactions[0].asset).to.be.deep.eq(voteTx.asset);
          });
      });
      it('should filter only secondsign tx', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?type=${TransactionType.SIGNATURE}&and:fromHeight=2`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(secondSignTx.id);
            expect(resp.body.transactions[0].asset).to.be.deep.eq(secondSignTx.asset);
          });
      });
      it('should filter only multiaccount tx');
    });
    describe('senderId filter', () => {
      it('should return only tx from such senderId', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?senderId=${voterAccount.address}&orderBy=height:asc`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(2);
            expect(resp.body.transactions[0].id).to.be.eq(voteTx.id);
            expect(resp.body.transactions[1].id).to.be.eq(secondSignTx.id);
          });
      });
      it('should return empty tx if senderId did not broadcast', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/transactions?senderId=1R&and:minAmount=0')
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.be.empty;
            expect(resp.body.count).to.be.eq(0);
          });
      });
    });

    describe('senderPublicKey', () => {
      it('should return only tx from such senderPublicKey', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?senderPublicKey=${voterAccount.publicKey}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(2);
            expect(resp.body.transactions[0].senderPublicKey).to.be.eq(voterAccount.publicKey);
            expect(resp.body.transactions[1].senderPublicKey).to.be.eq(voterAccount.publicKey);
          });
      });
      it('should return empty tx if senderPublicKey did not broadcast', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?senderPublicKey=${createRandomWallet().publicKey}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.be.empty;
          });
      });
    });
    describe('recipientId filter', () => {
      it('should return only tx for such recipientId', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?recipientId=${onlyReceiverAccount.address}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(onlyReceiverTxID);
          });
      });
      it('should return empty tx if there are not txs for such recipientId', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?recipientId=${createRandomWallet().address}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.be.empty;
          });
      });
    });
    describe('fromHeight filter', () => {
      it('should return txs that were broadcasted after that height', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/transactions?fromHeight=2')
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.not.be.empty;
            for (const tx of resp.body.transactions) {
              expect(tx.height).to.be.gte(2);
            }
          });
      });
      it('should return empty txs if there are no txs that were broadcasted after that height', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/transactions?fromHeight=100')
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.be.empty;
          });
      });
    });
    describe('toHeight filter', () => {
      it('should return txs that were broadcasted before that height', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/transactions?toHeight=2')
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.not.be.empty;
            for (const tx of resp.body.transactions) {
              expect(tx.height).to.be.lte(2);
            }
          });
      });
    });

    describe('fromTimestamp filter', () => {
      it('should return txs that were broadcasted after that timestamp');
      it('should return empty txs if there are no txs that were broadcasted after that timestamp');
    });
    describe('toTimestamp filter', () => {
      it('should return txs that were broadcasted before that timestamp');
      it('should return empty txs if there are no txs that were broadcasted before that timestamp');
    });
    describe('fromUnixTime filter', () => {
      it('should return txs that were broadcasted after that unix time');
      it('should return empty txs if there are no txs that were broadcasted after that unix time');
    });
    describe('toUnixTime filter', () => {
      it('should return txs that were broadcasted before that unix time');
      it('should return empty txs if there are no txs that were broadcasted before that unix time');
    });
    describe('minAmount filter', () => {
      it('should return txs that have a certain min amount');
    });
    describe('minConfirmations filter', () => {
      it('should return txs that have a certain min confirmations amount', async () => {
        const lastHeight = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks).lastBlock.height;
        // should include only genesisBlock
        const {count, transactions} = await supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?and:type=${TransactionType.SEND}&minConfirmations=${lastHeight - 1}&limit=200`)
          .then((resp) => resp.body);
        expect(transactions.length).is.eq(101);
        expect(count).is.eq(101);
        transactions.forEach((t) => expect(t.height).to.be.eq(1));
      });
    });
    describe('limit and offset', () => {
      beforeEach(async () => {
        await createRandomAccountWithFunds(Math.pow(10, 11));
        await createRandomAccountWithFunds(Math.pow(10, 11));
        await createRandomAccountWithFunds(Math.pow(10, 11));
      });
      it('should limit ret txs by limit and offset it', async () => {
        const {count, transactions} = await supertest(initializer.appManager.expressApp).get(`/api/transactions?type=${TransactionType.SEND}&orderBy=height:desc`)
          .then((resp) => resp.body);
        // offset!
        await supertest(initializer.appManager.expressApp).get(`/api/transactions?type=${TransactionType.SEND}&offset=1&orderBy=height:desc`)
          .then((resp) => {
            expect(resp.body.count).to.be.eq(count);
            expect(resp.body.transactions[0]).to.be.deep.eq(transactions[1]);
          });

        // limit and offset
        await supertest(initializer.appManager.expressApp).get(`/api/transactions?type=${TransactionType.SEND}&offset=2&limit=1&orderBy=height:desc`)
          .then((resp) => {
            expect(resp.body.count).to.be.eq(count);
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0]).to.be.deep.eq(transactions[2]);
          });
      });
    });
  });
  //
  describe('/count', () => {
    checkReturnObjKeyVal('confirmed', 303 /*# of genesis txs */, '/api/transactions/count');
    checkReturnObjKeyVal('unconfirmed', 0, '/api/transactions/count');
    checkReturnObjKeyVal('queued', 0, '/api/transactions/count');
    checkReturnObjKeyVal('multisignature', 0, '/api/transactions/count');
    describe('with some txs', () => {
      initializer.createBlocks(1, 'each');
      beforeEach(async () => {
        const txs: Array<ITransaction<any>> = [];
        for (let i = 0; i < 5; i++) {
          const tx = await createSendTransaction(
            0,
            Math.ceil(Math.random() * 100),
            getRandomDelegateWallet(),
            createRandomWallet().address);
          txs.push(tx);
        }
        const txModule = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
        for (const tx of txs) {
          await txModule.processUnconfirmedTransaction(toBufferedTransaction(tx), false);
        }
        const txPool = initializer.appManager.container.get<ITransactionPoolLogic>(Symbols.logic.transactionPool);
        await txPool.processBundled();
      });
      it('should return 5 queued', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/transactions/count')
          .expect(200)
          .then((resp) => {
            expect(resp.body.queued).is.eq(5);
          });
      });
      it('should return 5 unconfirmed if fillPool', async () => {
        const txModule = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
        await txModule.fillPool();
        return supertest(initializer.appManager.expressApp)
          .get('/api/transactions/count')
          .expect(200)
          .then((resp) => {
            expect(resp.body.unconfirmed).is.eq(5);
          });
      });
    });
    // TODO: multisignatures.
  });

  describe('/get', () => {

    let tx: ITransaction;
    let delegate1: LiskWallet;
    let senderAccount: LiskWallet;
    beforeEach(async () => {
      const {wallet: randomAccount} = await createRandomAccountWithFunds(Math.pow(10, 9));
      senderAccount                 = randomAccount;
      delegate1 = getRandomDelegateWallet();
      tx = await createVoteTransaction(1, senderAccount, delegate1.publicKey, true);
    });

    checkRequiredParam('id', '/api/transactions/get?id=1111');
    describe('vote tx', () => {
      it('should show asset object (corectly)', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions/get?id=${tx.id}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transaction.asset).to.be.an('object');
            expect(resp.body.transaction.asset).to.haveOwnProperty('votes');
            expect(resp.body.transaction.asset.votes).to.be.an('array');
            expect(resp.body.transaction.asset.votes).to.be.deep.eq([
              `+${delegate1.publicKey}`,
            ]);
          });
      });
      it('should also add votes object (deprecated stuff)', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions/get?id=${tx.id}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transaction.votes).to.be.an('object');
            expect(resp.body.transaction.votes).to.haveOwnProperty('added');
            expect(resp.body.transaction.votes).to.haveOwnProperty('deleted');
            expect(resp.body.transaction.votes.deleted).to.be.empty;
            expect(resp.body.transaction.votes.added).to.be.deep.eq([delegate1.publicKey]);
          });
      });
      it('should correctly also show deleted votes', async () => {
        const tx2 = await createVoteTransaction(1, senderAccount, delegate1.publicKey, false);
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions/get?id=${tx2.id}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transaction.votes).to.be.an('object');
            expect(resp.body.transaction.votes).to.haveOwnProperty('added');
            expect(resp.body.transaction.votes).to.haveOwnProperty('deleted');
            expect(resp.body.transaction.votes.added).to.be.empty;
            expect(resp.body.transaction.votes.deleted).to.be.deep.eq([delegate1.publicKey]);
          });
      });
    });
  });

  describe('/put', () => {
    it('should reject if transaction is empty');
    it('should reject if transaction is not valid');
  });
});
