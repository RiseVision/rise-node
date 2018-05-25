import initializer from '../common/init';
import {
  checkEnumParam,
  checkIntParam,
  checkPostPubKey,
  checkPostRequiredParam,
  checkPubKey,
  checkRequiredParam,
  checkReturnObjKeyVal
} from './utils';
import * as supertest from 'supertest';
import * as chai from 'chai';
import * as chaiSorted from 'chai-sorted';
import { IBlocksModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { ISlots } from '../../../src/ioc/interfaces/helpers';
import { AppConfig } from '../../../src/types/genericTypes';
import {
  confirmTransactions,
  createRandomAccountWithFunds,
  createSendTransaction,
  createVoteTransaction,
  createWallet,
  getRandomDelegateWallet
} from '../common/utils';
import { IForgeModule } from '../../../src/ioc/interfaces/modules/IForgeModule';
import { BlocksModel, TransactionsModel } from '../../../src/models';

chai.use(chaiSorted);

const {expect} = chai;
const delegates = require('../genesisDelegates.json');

// tslint:disable no-unused-expression max-line-length
describe('api/delegates', () => {

  initializer.setup();
  initializer.autoRestoreEach();
  before(async function() {
    this.timeout(10000);
    await initializer.rawMineBlocks(100);
  });

  describe('/', () => {
    checkEnumParam('orderBy', [
      'approval:desc', 'approval:asc',
      'productivity:desc', 'productivity:asc',
      'rank:desc', 'rank:asc',
      'vote:desc', 'vote:asc',
      'address:desc', 'address:asc',
      'username:desc', 'username:asc',
      'publicKey:desc', 'publicKey:asc',
    ], '/api/delegates');
    checkIntParam('limit', '/api/delegates', { min: 1, max: 101 });
    checkIntParam('offset', '/api/delegates', { min: 0 });

    checkReturnObjKeyVal('totalCount', 101, '/api/delegates');

    it('should return delegates array', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(Array.isArray(response.body.delegates));
          expect(response.body.delegates.map((d) => d.address).sort()).to.be.deep.equal(delegates.map((d) => d.address).sort());
        });
    });

    ['approval', 'productivity', 'rank', 'vote', 'username', 'address', 'publicKey'].forEach((sortKey: string) => {
      it('should honor orderBy ' + sortKey + ' asc param', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/delegates/?orderBy=' + sortKey + ':asc')
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(Array.isArray(response.body.delegates)).to.be.true;
            (expect(response.body.delegates).to.be as any).ascendingBy(sortKey);
          });
      });

      it('should honor orderBy ' + sortKey + ' desc param', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/delegates/?orderBy=' + sortKey + ':desc')
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(Array.isArray(response.body.delegates)).to.be.true;
            (expect(response.body.delegates).to.be as any).descendingBy(sortKey);
          });
      });
    });

    it('should honor limit param', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/?limit=10')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(Array.isArray(response.body.delegates)).to.be.true;
          expect(response.body.delegates.length).to.be.equal(10);
        });
    });

    it('should honor offset param', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/?offset=30')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(Array.isArray(response.body.delegates)).to.be.true;
          expect(response.body.delegates.length).to.be.equal(71);
        });
    });
  });

  describe('/fee', () => {
    checkIntParam('height', '/api/delegates/fee', { min: 1 });
    checkReturnObjKeyVal('fromHeight', 1, '/api/delegates/fee');
    checkReturnObjKeyVal('toHeight', null, '/api/delegates/fee');
    checkReturnObjKeyVal('height', 102, '/api/delegates/fee');

    it('should return fee value for delegate', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/fee')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.fee).to.be.equal(2500000000);
        });
    });
  });

  describe('/forging/getForgedByAccount', () => {
    checkIntParam('start', '/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3');
    checkIntParam('end', '/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3');
    checkPubKey('generatorPublicKey', '/api/delegates/forging/getForgedByAccount');

    it('should calculate the total forged amount', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3')
          .expect(200)
          .then((response) => {
            expect(response.body.forged).to.be.equal('1500000000');
      });
    });

    it('should calculate the forged amount accounting start and end', async () => {
      const start = new Date(new Date().getTime() - 1000).getTime() / 1000;
      const end = new Date().getTime() / 1000;
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/forging/getForgedByAccount?start=' + start + '&end=' + end + '&generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.forged).to.be.equal('0');
        });
    });
  });

  describe('/get', () => {
    checkPubKey('publicKey', '/api/delegates/get');

    it('should return delegate object by username', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/get?username=genesisDelegate32')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegate).to.be.deep.equal({
            username: 'genesisDelegate32',
            address: '15048500907174916103R',
            publicKey: 'b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3',
            vote: 108912391000000,
            producedblocks: 1,
            missedblocks: 1,
            rank: 64,
            approval: 0.99,
            productivity: 50,
            rate: 64,
          });
        });
    });

    it('should return delegate object by publicKey', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/get?publicKey=eec7460f47ea4df03cd28a7bc9017028477f247617346ba37b635ee13ef9ac44')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegate).to.be.deep.equal({
            username: 'genesisDelegate33',
            address: '14851457879581478143R',
            publicKey: 'eec7460f47ea4df03cd28a7bc9017028477f247617346ba37b635ee13ef9ac44',
            vote: 108912391000000,
            producedblocks: 1,
            missedblocks: 1,
            rank: 82,
            approval: 0.99,
            productivity: 50,
            rate: 82,
          });
        });
    });

    it('should throw delegate not found if delecate is not there', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/get?publicKey=77f247617346ba37b635ee13ef9ac44eec7460f47ea4df03cd28a7bc90170284') // pk does not exist
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.equal('Delegate not found');
        });
    });
  });

  describe('/voters', () => {
    checkPubKey('publicKey', '/api/delegates/voters');
    it('should return accounts that voted for delegate', async () => {
      const {wallet: newAcc} = await createRandomAccountWithFunds(1e10);
      await createVoteTransaction(1, newAcc, 'eec7460f47ea4df03cd28a7bc9017028477f247617346ba37b635ee13ef9ac44', true)
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/voters?publicKey=eec7460f47ea4df03cd28a7bc9017028477f247617346ba37b635ee13ef9ac44')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.accounts).to.be.deep.equal([
            {
              address: newAcc.address,
              balance: 1e10 - 1e8 /* voting fees */,
              publicKey: newAcc.publicKey,
              username: null,
            },
            {
            username: 'genesisDelegate33',
            address: '14851457879581478143R',
            publicKey: 'eec7460f47ea4df03cd28a7bc9017028477f247617346ba37b635ee13ef9ac44',
            balance: 108912391000000,
          }]);
        });
    });

    it('should return empty array if delegate does not exist', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/voters?publicKey=77f247617346ba37b635ee13ef9ac44eec7460f47ea4df03cd28a7bc90170284') // pk does not exist
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.accounts).to.be.deep.equal([]);
        });
    });
  });

  describe('/search', () => {
    checkRequiredParam('q', '/api/delegates/search?q=haha');
    checkIntParam('limit', '/api/delegates/search?q=haha', { min: 1, max: 1000 });
    it('should return delegates array matching search criteria', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/search?q=33')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.deep.equal([{
            username: 'genesisDelegate33',
            address: '14851457879581478143R',
            publicKey: 'eec7460f47ea4df03cd28a7bc9017028477f247617346ba37b635ee13ef9ac44',
            vote: 108912391000000,
            producedblocks: 1,
            missedblocks: 1,
            rank: 82,
            approval: 1.09,
            productivity: 50,
            register_timestamp: 0,
            voters_cnt: 1,
          }]);
        });
    });

    it('should honor limit parameter', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/search?q=genesis&limit=30')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates.length).to.be.equal(30);
        });
    });
  });

  describe('/count', () => {
    checkReturnObjKeyVal('count', 101, '/api/delegates/count');
  });

  describe('/getNextForgers', () => {
    let curBlock: BlocksModel;
    let slots: ISlots;
    let blocksModel: typeof BlocksModel;
    let blocksModule: IBlocksModule;
    let txModel: typeof TransactionsModel;
    beforeEach(async () => {
      blocksModule = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
      curBlock     = blocksModule.lastBlock;
      blocksModel  = initializer.appManager.container.get<typeof BlocksModel>(Symbols.models.blocks);
      txModel      = initializer.appManager.container.get<typeof TransactionsModel>(Symbols.models.transactions);
      slots        = initializer.appManager.container.get<ISlots>(Symbols.helpers.slots);
    });

    it('should return current block', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/getNextForgers').expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.currentBlock).to.be.deep.equal(blocksModel.toStringBlockType(
            curBlock,
            txModel,
            blocksModule
          ));
        });
    });
    it('should return currentBlock slot', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/getNextForgers').expect(200)
        .then((response) => {
          expect(response.body.currentBlockSlot).to.be.deep.equal(100);
        });
    });

    it('should return current slot (time)', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/getNextForgers').expect(200)
        .then((response) => {
          expect(response.body.currentSlot).to.be.deep.equal(slots.getSlotNumber());
        });
    });

    it('should return next delegates in line to forge', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/getNextForgers?limit=101').expect(200)
        .then((response) => {
          expect(response.body.delegates.length).to.be.equal(slots.delegates);
        });
    });
  });

  describe('/forging/status', () => {
    let cfg: AppConfig;
    beforeEach(async () => {
      cfg = initializer.appManager.container.get<AppConfig>(Symbols.generic.appConfig);
      cfg.forging.access.whiteList = [ '127.0.0.1', '::ffff:127.0.0.1'];
    });

    checkPubKey('publicKey', '/api/delegates/forging/status');

    it('should disallow request from unallowed ip', async () => {
      cfg.forging.access.whiteList = [];
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/forging/status').expect(403)
        .then((response) => {
          expect(response.body.error).to.be.equal('Delegates API access denied');
        });
    });

    it('should check for publicKey only if provided', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/forging/status?publicKey=241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14').expect(200)
        .then((response) => {
          expect(response.body).to.be.deep.equal({
            delegates: [ '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14' ],
            enabled: false ,
            success: true,
          });
        });
    });

    it('should return all enabled delegates to forge', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/forging/status').expect(200)
        .then((response) => {
          expect(response.body).to.be.deep.equal({
            delegates: [],
            enabled: false,
            success: true,
          });
        });
    });
  });

  describe('/forging/enable', () => {
    let cfg: AppConfig;
    beforeEach(async () => {
      cfg = initializer.appManager.container.get<AppConfig>(Symbols.generic.appConfig);
      cfg.forging.access.whiteList = [ '127.0.0.1', '::ffff:127.0.0.1'];
    });

    checkPostRequiredParam('secret', '/api/delegates/forging/enable', {
      publicKey: '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
    });
    checkPostPubKey('publicKey', '/api/delegates/forging/enable', {secret: 'aaa'});

    it('should disallow request from unallowed ip', async () => {
      cfg.forging.access.whiteList = [];
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/enable').expect(403)
        .then((response) => {
          expect(response.body.error).to.be.equal('Delegates API access denied');
        });
    });

    it('should throw error if given publicKey differs from computed pk', async () => {
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/enable')
        .send({
          publicKey: '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
          secret: 'sensereduceweirdpluck',
        }).expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Invalid passphrase');
        });
    });

    it('should throw error if forging is already enabled for such account', async () => {
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/enable')
        .send({
          publicKey: '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
          secret: 'sense reduce weird pluck result business unable dust garage gaze business anchor',
        }).expect(200)
        .then((response) => {
          return supertest(initializer.appManager.expressApp)
            .post('/api/delegates/forging/enable')
            .send({
              publicKey: '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
              secret: 'sense reduce weird pluck result business unable dust garage gaze business anchor',
            }).expect(200)
            .then((res) => {
              expect(res.body.error).to.be.equal('Forging is already enabled');
            });
        });
    });

    it('should throw error if account is not found', async () => {
      // Key pair is valid but account does not exist
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/enable')
        .send({
          publicKey: '0cf75c0afa655b7658d971765d4989d8553d639eeed57eaa45b1991b61db1856',
          secret: 'unable dust garage gaze business anchor sense reduce weird pluck result business',
        }).expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Account not found');
        });
    });

    it('should throw error if account is not a delegate', async () => {
      // Transfer some funds to a new account from a delegate
      const secret = 'business anchor sense reduce weird pluck result business unable dust garage gaze';
      const wallet = createWallet(secret);
      const tx = await createSendTransaction(
        0,
        Math.ceil(Math.random() * 100),
        getRandomDelegateWallet(),
        wallet.address
      );
      await confirmTransactions([tx], false);
      // Try to enable forging on this new non-delegate account
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/enable')
        .send({
          publicKey: wallet.publicKey,
          secret,
        }).expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Delegate not found');
        });
    });
  });

  describe('/forging/disable', () => {
    let cfg: AppConfig;
    beforeEach(async () => {
      cfg = initializer.appManager.container.get<AppConfig>(Symbols.generic.appConfig);
      cfg.forging.access.whiteList = [ '127.0.0.1', '::ffff:127.0.0.1'];
    });

    checkPostRequiredParam('secret', '/api/delegates/forging/disable', {});
    checkPostPubKey('publicKey', '/api/delegates/forging/disable', {
      secret: 'aaa',
    });

    it('should disallow request from unallowed ip', async () => {
      cfg.forging.access.whiteList = [];
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/disable').expect(403)
        .then((response) => {
          expect(response.body.error).to.be.equal('Delegates API access denied');
        });
    });

    it('should throw error if given publicKey differs from computed pk', async () => {
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/disable')
        .send({
          publicKey: '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
          secret: 'sensereduceweirdpluck',
        }).expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Invalid passphrase');
        });
    });

    it('should throw error if forging is already disabled for such account', async () => {
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/disable')
        .send({
          publicKey: '21ba4bd249c3369c1a1c15a2f309ce993db9396c55d519f17d0138fafee36d66',
          secret: 'chunk torch ice snow lunar cute school trigger portion gift home canal',
        }).expect(200).then((res) => {
          return supertest(initializer.appManager.expressApp)
            .post('/api/delegates/forging/disable')
            .send({
              publicKey: '21ba4bd249c3369c1a1c15a2f309ce993db9396c55d519f17d0138fafee36d66',
              secret: 'chunk torch ice snow lunar cute school trigger portion gift home canal',
            }).expect(200).then((resp) => {
              expect(resp.body.error).to.be.equal('Forging is already disabled');
            });
        });
    });

    it('should throw error if account is not found', async () => {
      const forgeModule = initializer.appManager.container.get<IForgeModule>(Symbols.modules.forge);
      forgeModule.enableForge({
        privateKey: Buffer.from('aaaa', 'hex'),
        publicKey: Buffer.from('b7717adf51800bce03b1aebdad444220734c423f0014944bfcdb8d615641c61e', 'hex'),
      });
      // Key pair is valid but account does not exist
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/disable')
        .send({
          publicKey: 'b7717adf51800bce03b1aebdad444220734c423f0014944bfcdb8d615641c61e',
          secret: 'pluck result dust unable garage gaze business anchor sense reduce weird business',
        }).expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Account not found');
        });
    });

    it('should throw error if account is not a delegate', async () => {
      // Transfer some funds to a new account from a delegate
      const secret = 'dust pluck sense reduce weird pluck result business unable dust sense gaze';
      const wallet = createWallet(secret);
      const tx = await createSendTransaction(
        0,
        Math.ceil(Math.random() * 100),
        getRandomDelegateWallet(),
        wallet.address
      );
      await confirmTransactions([tx], false);
      const forgeModule = initializer.appManager.container.get<IForgeModule>(Symbols.modules.forge);
      forgeModule.enableForge({
        privateKey: Buffer.from('aaaa', 'hex'),
        publicKey: Buffer.from(wallet.publicKey, 'hex'),
      });
      // Try to disable forging on this new non-delegate account
      return supertest(initializer.appManager.expressApp)
        .post('/api/delegates/forging/disable')
        .send({
          publicKey: wallet.publicKey,
          secret,
        }).expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Delegate not found');
        });
    });
  });

});
