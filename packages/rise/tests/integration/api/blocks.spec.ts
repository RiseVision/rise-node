import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import {
  checkIntParam,
  checkPubKey,
  checkRequiredParam,
  checkReturnObjKeyVal,
} from './utils';
import {
  createRandomAccountsWithFunds,
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransaction,
  createSecondSignTransaction,
  createSendTransaction,
  createVoteTransaction,
  getRandomDelegateWallet,
} from '../common/utils';
import { toBufferedTransaction } from '../../../../core-transactions/tests/unit/utils/txCrafter';
import { BlocksModule } from '@risevision/core-blocks';
import { Symbols } from '@risevision/core-interfaces';

// tslint:disable no-unused-expression max-line-length
describe('api/blocks', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  let blocksModule: BlocksModule;
  beforeEach(() => {
    blocksModule = initializer.appManager.container.get(Symbols.modules.blocks);
  });
  describe('/', () => {
    describe('validation', () => {
      describe('integers', () => {
        checkIntParam('totalAmount', '/api/blocks/', {
          min: 0,
          max: '10999999991000001',
        });
        checkIntParam('limit', '/api/blocks/', { min: 1, max: 100 });
        checkIntParam('totalFee', '/api/blocks/', {
          min: 0,
          max: '10999999991000001',
        });
        checkIntParam('height', '/api/blocks/', { min: 1 });
        checkIntParam('offset', '/api/blocks/', { min: 0 });
      });
      checkPubKey('generatorPublicKey', '/api/blocks');
      initializer.autoRestoreEach();
      it('should return an array of blocks', async () => {
        return supertest(initializer.apiExpress)
          .get('/api/blocks')
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(response.body).to.haveOwnProperty('blocks');
            expect(response.body.blocks).to.be.an('array');
            expect(response.body.blocks.length).to.be.eq(1);
            expect(response.body.blocks[0].transactions.length).to.be.eq(303);
          });
      });
      it('should account offset & orderBy parameter', async () => {
        const initialHeight = blocksModule.lastBlock.height;
        await initializer.rawMineBlocks(3);
        return supertest(initializer.apiExpress)
          .get(`/api/blocks?offset=${initialHeight}&orderBy=height:asc`)
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(response.body.blocks).to.be.an('array');
            expect(response.body.blocks.length).to.be.eq(3);
            expect(response.body.blocks[0].height).to.be.eq(initialHeight + 1);
            expect(response.body.blocks[1].height).to.be.eq(initialHeight + 2);
            expect(response.body.blocks[2].height).to.be.eq(initialHeight + 3);
          });
      });
      it('should account limit parameter', async () => {
        const initialHeight = blocksModule.lastBlock.height;
        await initializer.rawMineBlocks(3);
        return supertest(initializer.apiExpress)
          .get(`/api/blocks?offset=${initialHeight}&orderBy=height:asc&limit=1`)
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(response.body.blocks).to.be.an('array');
            expect(response.body.blocks.length).to.be.eq(1);
            expect(response.body.blocks[0].height).to.be.eq(initialHeight + 1);
          });
      });
      it('should filter block by height');
      it('should filter block by previousBlock');
      it('should filter block by reward');
      it('should filter block by totalAmount');
      it('should filter block by totalFee');
      it('should filter block by generatorPublicKey');

      it("should return block's transactions with assets per each tx", async () => {
        const data = await createRandomAccountsWithFunds(4, 1e10);
        const txs = [
          await createSendTransaction(0, 1, data[0].account, '1R'),
          await createSecondSignTransaction(
            0,
            data[3].account,
            createRandomWallet().publicKey
          ),
          await createRegDelegateTransaction(0, data[2].account, 'meoaaw'),
          await createVoteTransaction(
            0,
            data[1].account,
            getRandomDelegateWallet().publicKey,
            true
          ),
        ];
        await initializer.rawMineBlockWithTxs(
          txs.map((t) => toBufferedTransaction(t))
        );
        const { body } = await supertest(initializer.apiExpress)
          .get('/api/blocks/?limit=1&orderBy=height:desc')
          .expect(200);
        expect(body.blocks[0].transactions[0].asset).deep.eq(txs[0].asset);
        expect(body.blocks[0].transactions[1].asset).deep.eq(txs[1].asset);
        expect(body.blocks[0].transactions[2].asset).deep.eq(txs[2].asset);
        expect(body.blocks[0].transactions[3].asset).deep.eq(txs[3].asset);
      });
    });
  });

  describe('/get', () => {
    checkRequiredParam('id', '/api/blocks/get');
    it('should return block object', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/blocks/get?id=16985986483000875063')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body).to.haveOwnProperty('block');
          expect(response.body.block).to.be.an('object');
        });
    });
    it('should throw block not found if invalid block id is given', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/blocks/get?id=1')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Block not found');
        });
    });

    it("should return block's transactions with assets per each tx", async () => {
      const data = await createRandomAccountsWithFunds(4, 1e10);
      const txs = [
        await createSendTransaction(0, 1, data[0].account, '1R'),
        await createSecondSignTransaction(
          0,
          data[3].account,
          createRandomWallet().publicKey
        ),
        await createRegDelegateTransaction(0, data[2].account, 'meoaaw'),
        await createVoteTransaction(
          0,
          data[1].account,
          getRandomDelegateWallet().publicKey,
          true
        ),
      ];
      const b = await initializer.rawMineBlockWithTxs(
        txs.map((t) => toBufferedTransaction(t))
      );
      const { body } = await supertest(initializer.apiExpress)
        .get(`/api/blocks/get?id=${b.id}`)
        .expect(200);
      expect(body.block.transactions[0].asset).deep.eq(txs[0].asset);
      expect(body.block.transactions[1].asset).deep.eq(txs[1].asset);
      expect(body.block.transactions[2].asset).deep.eq(txs[2].asset);
      expect(body.block.transactions[3].asset).deep.eq(txs[3].asset);
    });
  });

  describe('/getHeight', () => {
    checkReturnObjKeyVal('height', 1, '/api/blocks/getHeight');
    it('should return corret height', async () => {
      await initializer.rawMineBlocks(10);
      return supertest(initializer.apiExpress)
        .get('/api/blocks/getHeight')
        .expect(200)
        .then((response) => {
          expect(response.body.height).to.be.eq(11);
        });
    });
  });

  describe('/getBroadhash', () => {
    checkReturnObjKeyVal(
      'broadhash',
      'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
      '/api/blocks/getBroadhash'
    );
    it('should change broadhash and return new one if based on known blocks', async () => {
      await initializer.rawMineBlocks(5);
      return supertest(initializer.apiExpress)
        .get('/api/blocks/getBroadhash')
        .expect(200)
        .then((response) => {
          expect(response.body.broadhash).to.be.eq(
            'f68c3359a8cc863e5f4bf8aee984022e1e5faf74dc4f3c12c5ae922ce7b078a9'
          );
        });
    });
  });

  describe('/getEpoch', () => {
    checkReturnObjKeyVal(
      'epoch',
      '2016-05-24T17:00:00.000Z',
      '/api/blocks/getEpoch'
    );
  });

  describe('/getFee', () => {
    checkIntParam('height', '/api/blocks/getFee', { min: 0 });
    // checkRequiredParam('height', '/api/blocks/getFee');
    it('should return obj with several elements', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/blocks/getFee')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body).to.haveOwnProperty('fromHeight');
          expect(response.body).to.haveOwnProperty('toHeight');
          expect(response.body).to.haveOwnProperty('height');
          expect(response.body).to.haveOwnProperty('fee');
          expect(response.body.fromHeight).to.be.a('number');
          // expect(response.body.toHeight).to.be.a('number');
          expect(response.body.height).to.be.a('number');
          expect(response.body.fee).to.be.a('number');
        });
    });
    it('should use provided height', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/blocks/getFee?height=10000&asd=asd')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.height).to.be.deep.eq(10000);
        });
    });
  });

  describe('/getFees', () => {
    checkIntParam('height', '/api/blocks/getFees', { min: 0 });
    // checkRequiredParam('height', '/api/blocks/getFees')
    checkReturnObjKeyVal('fromHeight', 1, '/api/blocks/getFees');
    checkReturnObjKeyVal('toHeight', null, '/api/blocks/getFees');
    checkReturnObjKeyVal('height', 2, '/api/blocks/getFees');

    it('should return fees obj with several elements', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/blocks/getFees')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body).to.haveOwnProperty('fees');
          expect(response.body.fees).to.haveOwnProperty('send');
          expect(response.body.fees).to.haveOwnProperty('vote');
          expect(response.body.fees).to.haveOwnProperty('secondsignature');
          expect(response.body.fees).to.haveOwnProperty('delegate');
          expect(response.body.fees).to.haveOwnProperty('multisignature');
        });
    });

    it('should use provided height', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/blocks/getFees?height=10000&asd=asd')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.height).to.be.deep.eq(10000);
        });
    });
  });

  describe('/getNethash', () => {
    checkReturnObjKeyVal(
      'nethash',
      'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
      '/api/blocks/getNethash'
    );
  });

  describe('/getMilestone', () => {
    checkReturnObjKeyVal('milestone', 0, '/api/blocks/getMilestone');
  });

  describe('/getReward', () => {
    checkReturnObjKeyVal(
      'reward',
      0, // height 1 - 10 has reward 0
      '/api/blocks/getReward'
    );
  });

  describe('/getSupply', () => {
    checkReturnObjKeyVal(
      'supply',
      10999999991000000, // height 1 - 10 has reward 0
      '/api/blocks/getSupply'
    );
    it('should calc supply correctly for height 100', async function() {
      this.timeout(20000);
      await initializer.rawMineBlocks(99); // 1 is already mined
      return supertest(initializer.apiExpress)
        .get('/api/blocks/getSupply')
        .expect(200)
        .then((response) => {
          expect(response.body.supply).to.be.eq(
            10999999991000000 +
            (100 - 13 + 1) * 1500000000 + // blocks 13- 100
            20000000 + // block 12
            30000000 + // block 11
              1500000000 // block 10
          );
        });
    });
  });

  describe('/getStatus', () => {
    checkReturnObjKeyVal(
      'nethash',
      'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
      '/api/blocks/getStatus'
    );
    checkReturnObjKeyVal(
      'broadhash',
      'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
      '/api/blocks/getStatus'
    );
    checkReturnObjKeyVal('fee', 10000000, '/api/blocks/getStatus');
    checkReturnObjKeyVal('height', 1, '/api/blocks/getStatus');
    checkReturnObjKeyVal('milestone', 0, '/api/blocks/getStatus');
    checkReturnObjKeyVal('reward', 0, '/api/blocks/getStatus');
    checkReturnObjKeyVal('supply', 10999999991000000, '/api/blocks/getStatus');
  });
});
