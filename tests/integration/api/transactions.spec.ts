import { expect } from 'chai';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import * as supertest from 'supertest';
import { constants, TransactionType } from '../../../src/helpers';
import { ITransactionPoolLogic } from '../../../src/ioc/interfaces/logic';
import { ITransactionsModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { IBaseTransaction } from '../../../src/logic/transactions';

import initializer from '../common/init';
import {
  createRandomAccountWithFunds, createRandomWallet,
  createSendTransaction,
  createVoteTransaction,
  getRandomDelegateWallet
} from '../common/utils';
import { checkAddress, checkIntParam, checkPubKey, checkReturnObjKeyVal } from './utils';

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

    let voteTxID: string;
    let sendTxID: string;
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

      const t  = await createVoteTransaction(
        1,
        randomAccount,
        senderAccount.publicKey,
        true
      );
      voteTxID = t.id;

      const {wallet: rA, txID: ortid} = await createRandomAccountWithFunds(Math.pow(10, 10));
      onlyReceiverTxID                = ortid;
      onlyReceiverAccount             = rA;

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
      it('should filter only send tx');
      it('should filter only vote tx', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?type=${TransactionType.VOTE}&orderBy=height:desc&and:fromHeight=2`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(voteTxID);
          });
      });
      it('should filter only secondsign tx');
      it('should filter only multiaccount tx');
    });
    describe('senderId filter', () => {
      it('should return only tx from such senderId', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?senderId=${voterAccount.address}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(voteTxID);
          });
      });
      it('should return empty tx if senderId did not broadcast', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/transactions?senderId=1R')
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.be.empty;
          });
      });
    });
    describe('senderPublicKey', () => {
      it('should return only tx from such senderPublicKey', async () => {
        return supertest(initializer.appManager.expressApp)
          .get(`/api/transactions?senderPublicKey=${voterAccount.publicKey}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(voteTxID);
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
      it('should return txs that have a certain min confirmations amount');
    });
    describe('limit and offset', () => {
      it('should limit ret txs by limit and offset it');
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
        const txs: Array<IBaseTransaction<any>> = [];
        for (let i = 0; i < 5; i++) {
          const tx = await createSendTransaction(
            0,
            Math.ceil(Math.random() * 100),
            getRandomDelegateWallet(),
            createRandomWallet().address);
          txs.push(tx);
        }
        const txModule = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
        await txModule.receiveTransactions(txs, false, false);
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
        const txPool = initializer.appManager.container.get<ITransactionPoolLogic>(Symbols.logic.transactionPool);
        await txPool.fillPool();
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
});
