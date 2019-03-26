import { APIConfig } from '@risevision/core-apis';
import {
  IBlocksModule,
  ITransactionsModule,
  Symbols,
} from '@risevision/core-interfaces';
import {
  PoolManager,
  TransactionPool,
  TXSymbols,
} from '@risevision/core-transactions';
import { IKeypair, TransactionType } from '@risevision/core-types';
import { wait } from '@risevision/core-utils';
import { expect } from 'chai';
import * as supertest from 'supertest';
import { toNativeTx } from '../../../../core-transactions/tests/unit/utils/txCrafter';
import initializer from '../common/init';
import {
  createRandomAccountWithFunds,
  createRandomWallet,
  createSecondSignTransactionV1,
  createSendTransactionV1,
  createVoteTransactionV1,
  createWalletV2,
  getRandomDelegateSecret,
  getRandomDelegateWallet,
} from '../common/utils';
import {
  checkAddress,
  checkEnumParam,
  checkIntParam,
  checkPubKey,
  checkRequiredParam,
  checkReturnObjKeyVal,
} from './utils';

import { Rise, RiseTransaction, RiseV2 } from 'dpos-offline';
import uuid = require('uuid');

// tslint:disable no-unused-expression max-line-length no-identical-functions no-big-function object-literal-sort-keys
describe('api/transactions', () => {
  initializer.setup();

  describe('/', () => {
    // TODO: blockid and and:Blockid
    checkIntParam('and:type', '/api/transactions', { min: 0, max: 10 });
    checkIntParam('type', '/api/transactions', { min: 0, max: 10 });

    checkAddress('and:senderId', '/api/transactions');
    checkAddress('senderId', '/api/transactions');

    // checkPubKey('and:senderPubData', '/api/transactions');
    // checkPubKey('senderPubData', '/api/transactions');

    checkAddress('and:recipientId', '/api/transactions');
    checkAddress('recipientId', '/api/transactions');

    checkIntParam('and:fromHeight', '/api/transactions', { min: 1 });
    checkIntParam('fromHeight', '/api/transactions', { min: 1 });

    checkIntParam('and:toHeight', '/api/transactions', { min: 1 });
    checkIntParam('toHeight', '/api/transactions', { min: 1 });

    checkIntParam('and:fromTimestamp', '/api/transactions', { min: 0 });
    checkIntParam('fromTimestamp', '/api/transactions', { min: 0 });

    checkIntParam('and:toTimestamp', '/api/transactions', { min: 1 });
    checkIntParam('toTimestamp', '/api/transactions', { min: 1 });

    // TODO: Lerna
    // checkIntParam('and:fromUnixTime', '/api/transactions', {min: 1466787600000 / 1000});
    // checkIntParam('fromUnixTime', '/api/transactions', {min: 1466787600000 / 1000});
    //
    // checkIntParam('and:toUnixTime', '/api/transactions', {min: 1466787600000 / 1000});
    // checkIntParam('toUnixTime', '/api/transactions', {min: 1466787600000 / 1000});

    checkIntParam('and:minAmount', '/api/transactions', { min: 0 });
    checkIntParam('minAmount', '/api/transactions', { min: 0 });

    checkIntParam('and:minConfirmations', '/api/transactions', { min: 0 });
    checkIntParam('minConfirmations', '/api/transactions', { min: 0 });

    checkIntParam('limit', '/api/transactions', { min: 1, max: 200 });
    checkIntParam('offset', '/api/transactions', { min: 0 });

    checkEnumParam(
      'orderBy',
      [
        'height:asc',
        'height:desc',
        'timestamp:asc',
        'timestamp:desc',
        'amount:asc',
        'amount:desc',
      ],
      '/api/transactions'
    );

    let voteTx: RiseTransaction<any>;
    let sendTxID: string;
    let secondSignTx: RiseTransaction<any>;
    let onlyReceiverTxID: string;
    let senderAccount: IKeypair;
    let voterAccount: IKeypair;
    let onlyReceiverAccount: IKeypair;

    // it makes sure to remove created transactions.
    initializer.autoRestoreEach();

    beforeEach(async () => {
      senderAccount = getRandomDelegateWallet();
      const {
        wallet: randomAccount,
        txID,
      } = await createRandomAccountWithFunds(Math.pow(10, 11));
      voterAccount = randomAccount;
      sendTxID = txID;

      voteTx = await createVoteTransactionV1(
        1,
        randomAccount,
        senderAccount.publicKey,
        true
      );

      const { wallet: rA, txID: ortid } = await createRandomAccountWithFunds(
        Math.pow(10, 10)
      );
      onlyReceiverTxID = ortid;
      onlyReceiverAccount = rA;

      secondSignTx = await createSecondSignTransactionV1(
        1,
        voterAccount,
        createRandomWallet().publicKey
      );
    });

    it('should disallow an unknown query parameter', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/transactions?hey=brooother')
        .expect(200)
        .then((resp) => {
          expect(resp.body.error).to.contain(
            'Additional properties not allowed'
          );
        });
    });
    describe('type filter', () => {
      it('should filter only send tx', async () => {
        return supertest(initializer.apiExpress)
          .get(
            `/api/transactions?type=${
              TransactionType.SEND
            }&and:fromHeight=2&orderBy=height:asc`
          )
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(2);
            expect(resp.body.transactions[0].id).to.be.eq(sendTxID);
          });
      });
      it('should filter only vote tx', async () => {
        return supertest(initializer.apiExpress)
          .get(
            `/api/transactions?type=${TransactionType.VOTE}&and:fromHeight=2`
          )
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(voteTx.id);
            expect(resp.body.transactions[0].asset).to.be.deep.eq(voteTx.asset);
          });
      });
      it('should filter only secondsign tx', async () => {
        return supertest(initializer.apiExpress)
          .get(
            `/api/transactions?type=${
              TransactionType.SIGNATURE
            }&and:fromHeight=2`
          )
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(secondSignTx.id);
            expect(resp.body.transactions[0].asset).to.be.deep.eq({
              signature: {
                publicKey: secondSignTx.asset.signature.publicKey.toString(
                  'hex'
                ),
              },
            });
          });
      });
      it('should filter only multiaccount tx');
    });
    describe('senderId filter', () => {
      it('should return only tx from such senderId', async () => {
        return supertest(initializer.apiExpress)
          .get(
            `/api/transactions?senderId=${Rise.calcAddress(
              voterAccount.publicKey
            )}&orderBy=height:asc`
          )
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(2);
            expect(resp.body.transactions[0].id).to.be.eq(voteTx.id);
            expect(resp.body.transactions[1].id).to.be.eq(secondSignTx.id);
          });
      });
      it('should return empty tx if senderId did not broadcast', async () => {
        return supertest(initializer.apiExpress)
          .get('/api/transactions?senderId=1R&and:minAmount=0')
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.be.empty;
            expect(resp.body.count).to.be.eq(0);
          });
      });
    });

    describe('recipientId filter', () => {
      it('should return only tx for such recipientId', async () => {
        return supertest(initializer.apiExpress)
          .get(
            `/api/transactions?recipientId=${Rise.calcAddress(
              onlyReceiverAccount.publicKey
            )}`
          )
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions.length).to.be.eq(1);
            expect(resp.body.transactions[0].id).to.be.eq(onlyReceiverTxID);
          });
      });
      it('should return empty tx if there are not txs for such recipientId', async () => {
        return supertest(initializer.apiExpress)
          .get(`/api/transactions?recipientId=${createRandomWallet().address}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.be.empty;
          });
      });
    });
    describe('fromHeight filter', () => {
      it('should return txs that were broadcasted after that height', async () => {
        return supertest(initializer.apiExpress)
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
        return supertest(initializer.apiExpress)
          .get('/api/transactions?fromHeight=100')
          .expect(200)
          .then((resp) => {
            expect(resp.body.transactions).to.be.empty;
          });
      });
    });
    describe('toHeight filter', () => {
      it('should return txs that were broadcasted before that height', async () => {
        return supertest(initializer.apiExpress)
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
      it(
        'should return empty txs if there are no txs that were broadcasted after that timestamp'
      );
    });
    describe('toTimestamp filter', () => {
      it('should return txs that were broadcasted before that timestamp');
      it(
        'should return empty txs if there are no txs that were broadcasted before that timestamp'
      );
    });
    describe('fromUnixTime filter', () => {
      it('should return txs that were broadcasted after that unix time');
      it(
        'should return empty txs if there are no txs that were broadcasted after that unix time'
      );
    });
    describe('toUnixTime filter', () => {
      it('should return txs that were broadcasted before that unix time');
      it(
        'should return empty txs if there are no txs that were broadcasted before that unix time'
      );
    });
    describe('minAmount filter', () => {
      it('should return txs that have a certain min amount');
    });
    describe('minConfirmations filter', () => {
      it('should return txs that have a certain min confirmations amount', async () => {
        const lastHeight = initializer.appManager.container.get<IBlocksModule>(
          Symbols.modules.blocks
        ).lastBlock.height;
        // should include only genesisBlock
        const { count, transactions } = await supertest(initializer.apiExpress)
          .get(
            `/api/transactions?and:type=${
              TransactionType.SEND
            }&minConfirmations=${lastHeight - 1}&limit=200`
          )
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
        const { count, transactions } = await supertest(initializer.apiExpress)
          .get(
            `/api/transactions?type=${TransactionType.SEND}&orderBy=height:desc`
          )
          .then((resp) => resp.body);
        // offset!
        await supertest(initializer.apiExpress)
          .get(
            `/api/transactions?type=${
              TransactionType.SEND
            }&offset=1&orderBy=height:desc`
          )
          .then((resp) => {
            expect(resp.body.count).to.be.eq(count);
            expect(resp.body.transactions[0]).to.be.deep.eq(transactions[1]);
          });

        // limit and offset
        await supertest(initializer.apiExpress)
          .get(
            `/api/transactions?type=${
              TransactionType.SEND
            }&offset=2&limit=1&orderBy=height:desc`
          )
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
    checkReturnObjKeyVal(
      'confirmed',
      303 /*# of genesis txs */,
      '/api/transactions/count'
    );
    checkReturnObjKeyVal('unconfirmed', 0, '/api/transactions/count');
    checkReturnObjKeyVal('queued', 0, '/api/transactions/count');
    checkReturnObjKeyVal('pending', 0, '/api/transactions/count');
    describe('with some txs', () => {
      initializer.createBlocks(1, 'each');
      beforeEach(async () => {
        const txs: Array<RiseTransaction<any>> = [];
        for (let i = 0; i < 5; i++) {
          const tx = await createSendTransactionV1(
            0,
            Math.ceil(Math.random() * 100),
            getRandomDelegateWallet(),
            createRandomWallet().address
          );
          txs.push(tx);
        }
        const txModule = initializer.appManager.container.get<
          ITransactionsModule
        >(Symbols.modules.transactions);

        await txModule.processIncomingTransactions(
          txs.map((tx) => toNativeTx(tx)),
          null
        );
      });
      afterEach(async () => {
        const txPool = initializer.appManager.container.get<PoolManager>(
          TXSymbols.poolManager
        );
        await txPool.processPool();
      });
      it('should return 5 queued', async () => {
        return supertest(initializer.apiExpress)
          .get('/api/transactions/count')
          .expect(200)
          .then((resp) => {
            expect(resp.body.queued).is.eq(5);
          });
      });
      it('should return 5 unconfirmed if fillPool', async () => {
        const txPool = initializer.appManager.container.get<PoolManager>(
          TXSymbols.poolManager
        );
        await txPool.processPool();
        return supertest(initializer.apiExpress)
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
    let tx: RiseTransaction<any>;
    let delegate1: IKeypair;
    let senderAccount: IKeypair;
    beforeEach(async () => {
      const { wallet: randomAccount } = await createRandomAccountWithFunds(
        Math.pow(10, 9)
      );
      senderAccount = randomAccount;
      delegate1 = getRandomDelegateWallet();
      tx = await createVoteTransactionV1(
        1,
        senderAccount,
        delegate1.publicKey,
        true
      );
    });

    checkRequiredParam('id', '/api/transactions/get?id=1111');
    describe('vote tx', () => {
      it('should show asset object (corectly)', async () => {
        return supertest(initializer.apiExpress)
          .get(`/api/transactions/get?id=${tx.id}`)
          .expect(200)
          .then((resp) => {
            expect(resp.body.transaction.asset).to.be.an('object');
            expect(resp.body.transaction.asset).to.haveOwnProperty('votes');
            expect(resp.body.transaction.asset.votes).to.be.an('array');
            expect(resp.body.transaction.asset.votes).to.be.deep.eq([
              `+${delegate1.publicKey.toString('hex')}`,
            ]);
          });
      });
    });
  });

  describe('/post', () => {
    beforeEach(async () => {
      const conf = initializer.appManager.container.get<APIConfig>(
        Symbols.generic.appConfig
      );
      conf.api.access.restrictedWhiteList = ['127.0.0.1', '::ffff:127.0.0.1'];
    });

    it('should create a new tx', async () => {
      const txPool = initializer.appManager.container.get<TransactionPool>(
        TXSymbols.pool
      );

      const wallet = createWalletV2('meow');
      await createRandomAccountWithFunds(1e10, wallet);

      await supertest(initializer.apiExpress)
        .post('/api/transactions')
        .send({
          secret: 'meow',
          recipientId: createRandomWallet().address,
          amount: 10,
        })
        .expect(200)
        .then(async (r) => {
          expect(r.body.success).true;
          expect(r.body.transactionId).not.empty;
          await wait(1000);
          expect(txPool.transactionInPool(r.body.transactionId)).is.true;
        });
    });
    it('should fail tx', async () => {
      const secret = uuid.v4();
      const wallet = createWalletV2(secret);
      await createRandomAccountWithFunds(1e10, wallet);

      await supertest(initializer.apiExpress)
        .post('/api/transactions')
        .send({
          secret,
          recipientId: createRandomWallet().address,
          amount: 1e10 - 1,
        })
        .expect(200)
        .then((r) => {
          expect(r.body.success).false;
          expect(r.body.error).contain('enough currency');
        });
    });
    it('should return 403', async () => {
      (initializer.apiExpress as any).enable('trust proxy');
      const s = getRandomDelegateSecret();
      await supertest(initializer.apiExpress)
        .post('/api/transactions')
        .set('X-Forwarded-For', '8.8.8.8')
        .send({
          secret: s,
          recipientId: createRandomWallet().address,
          amount: 1,
        })
        .expect(403)
        .then((r) => {
          expect(r.body.success).false;
          expect(r.body.error).contain('Private API access denied');
        });
    });
  });

  describe('/put', () => {
    let tx: RiseTransaction<any>;
    let delegate1: IKeypair;
    let senderAccount: IKeypair;
    beforeEach(async () => {
      const { wallet: randomAccount } = await createRandomAccountWithFunds(
        Math.pow(10, 9)
      );
      senderAccount = randomAccount;
      delegate1 = getRandomDelegateWallet();
      tx = await createVoteTransactionV1(
        1,
        senderAccount,
        delegate1.publicKey,
        true
      );
    });
    it('should reject voting tx', async () => {
      const voteTX = await createVoteTransactionV1(
        0,
        senderAccount,
        delegate1.publicKey,
        true,
        { nonce: 2 }
      );

      const postableTx: any = Rise.txs.toPostable(voteTX);
      postableTx.senderPubData = postableTx.senderPublicKey;
      postableTx.signatures = [postableTx.signature];

      expect(voteTX.id).not.eq(tx.id);
      await supertest(initializer.apiExpress)
        .put('/api/transactions/')
        .send({ transaction: postableTx })
        .expect(200, {
          success: true,
          accepted: [],
          invalid: [
            {
              id: voteTX.id,
              reason:
                'Failed to add vote, account has already voted for this delegate',
            },
          ],
        });

      // Same thing if tx came from array
      await supertest(initializer.apiExpress)
        .put('/api/transactions/')
        .send({ transactions: [postableTx] })
        .expect(200, {
          success: true,
          accepted: [],
          invalid: [
            {
              id: voteTX.id,
              reason:
                'Failed to add vote, account has already voted for this delegate',
            },
          ],
        });
    });
    it('should reject malformed Transaction', async () => {
      const orig = await createSendTransactionV1(
        0,
        1,
        senderAccount,
        Rise.calcAddress(senderAccount.publicKey)
      );
      let postableTx: any = Rise.txs.toPostable(orig);
      postableTx.senderPubData = postableTx.senderPublicKey;
      postableTx.signatures = [postableTx.signature];
      await supertest(initializer.apiExpress)
        .put('/api/transactions/')
        .send({ transactions: [{ ...postableTx, senderId: null }] })
        .expect(200, {
          success: true,
          accepted: [],
          invalid: [
            {
              id: postableTx.id,
              reason:
                'Failed to validate transaction schema: Missing required property: senderId',
            },
          ],
        });

      await supertest(initializer.apiExpress)
        .put('/api/transactions/')
        .send({ transactions: [{ ...postableTx, id: '10' }] })
        .expect(200, {
          success: true,
          accepted: [],
          invalid: [
            {
              id: '10',
              reason: `Invalid transaction id - Expected ${
                postableTx.id
              }, Received 10`,
            },
          ],
        });

      // Asset validation
      const unvoteTX = await createVoteTransactionV1(
        0,
        senderAccount,
        delegate1.publicKey,
        false
      ); /*unvote */
      postableTx = Rise.txs.toPostable(unvoteTX);
      postableTx.senderPubData = postableTx.senderPublicKey;
      postableTx.signatures = [postableTx.signature];
      (unvoteTX.asset as any).votes.push('meow');
      await supertest(initializer.apiExpress)
        .put('/api/transactions/')
        .send({ transaction: postableTx })
        .expect(200, {
          success: true,
          accepted: [],
          invalid: [
            {
              id: postableTx.id,
              reason:
                'Failed to validate vote schema: String does not match pattern ^[-+]{1}[0-9a-z]{64}$: meow',
            },
          ],
        });
    });
    it('should accept unvote transaction', async () => {
      const unvoteTX = await createVoteTransactionV1(
        0,
        senderAccount,
        delegate1.publicKey,
        false
      ); /*unvote */
      const postableTx: any = Rise.txs.toPostable(unvoteTX);
      postableTx.senderPubData = postableTx.senderPublicKey;
      postableTx.signatures = [postableTx.signature];
      await supertest(initializer.apiExpress)
        .put('/api/transactions/')
        .send({ transaction: postableTx })
        .expect(200, { success: true, accepted: [postableTx.id], invalid: [] });
    });
    it('should accept unvote tx from multiple txs', async () => {
      const unvoteTX = await createVoteTransactionV1(
        0,
        senderAccount,
        delegate1.publicKey,
        false
      ); /*unvote */

      const postableTx: any = Rise.txs.toPostable(unvoteTX);
      postableTx.senderPubData = postableTx.senderPublicKey;
      postableTx.signatures = [postableTx.signature];
      await supertest(initializer.apiExpress)
        .put('/api/transactions/')
        .send({ transactions: [postableTx] })
        .expect(200, { success: true, accepted: [postableTx.id], invalid: [] });
    });
  });
});
