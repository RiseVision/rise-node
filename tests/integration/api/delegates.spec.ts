import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkEnumParam, checkIntParam, checkPubKey, checkRequiredParam, checkReturnObjKeyVal } from './utils';
import { Symbols } from '../../../src/ioc/symbols';
import constants from '../../../src/helpers/constants';
import { BlocksModel } from '../../../src/models';

// tslint:disable no-unused-expression max-line-length
describe('api/delegates', () => {

  initializer.setup();

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
    checkIntParam('limit', '/api/delegates', {min: 1, max: 101});
    checkIntParam('offset', '/api/delegates', {min: 0});

    checkReturnObjKeyVal('totalCount', 101, '/api/delegates');
    it('should return delegates array', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.an('array');
          expect(response.body.delegates.length).to.be.eq(101);
        });
    });
    it('should honor orderBy asc param', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates?orderBy=username:asc')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.an('array');
          expect(response.body.delegates.length).to.be.eq(101);
          expect(response.body.delegates[0].username).to.be.eq('genesisDelegate1');
          expect(response.body.delegates[100].username).to.be.eq('genesisDelegate99');
        });
    });
    it('should honor orderBy desc param', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates?orderBy=rank:desc')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.an('array');
          expect(response.body.delegates.length).to.be.eq(101);
          expect(response.body.delegates[0].rank).to.be.eq(101);
          expect(response.body.delegates[100].rank).to.be.eq(1);
        });
    });
    it('should honor limit param', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates?orderBy=rank:desc&limit=1')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.an('array');
          expect(response.body.delegates.length).to.be.eq(1);
          expect(response.body.delegates[0].rank).to.be.eq(101);
        });
    });
    it('should honor offset param', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates?orderBy=rank:desc&limit=1&offset=10')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.an('array');
          expect(response.body.delegates.length).to.be.eq(1);
          expect(response.body.delegates[0].rank).to.be.eq(101 - 10/*offset*/);
        });
    });
  });

  describe('/fee', () => {
    checkIntParam('height', '/api/delegates/fee', {min: 1});
    checkReturnObjKeyVal('fromHeight', 1, '/api/delegates/fee');
    checkReturnObjKeyVal('toHeight', null, '/api/delegates/fee');
    checkReturnObjKeyVal('height', 2, '/api/delegates/fee');
    checkReturnObjKeyVal('fee', 2500000000, '/api/delegates/fee');
    checkReturnObjKeyVal('height', 100, '/api/delegates/fee?height=100');
  });

  describe('/forging/getForgedByAccount', () => {
    initializer.createBlocks(404, 'single');
    checkIntParam('start', '/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3');
    checkIntParam('end', '/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3');
    checkPubKey('generatorPublicKey', '/api/delegates/forging/getForgedByAccount');
    it('should calculate the total forged amount', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3')
        .expect(200)
        .then((response) => {
          expect(response.body.forged).to.be.eq('6000000000');
          expect(response.body.rewards).to.be.eq(6000000000);
        });
    });
    it('should calculate the forged amount accounting start and end', async () => {
      const c      = initializer.appManager.container.get<typeof constants>(Symbols.helpers.constants);
      const bm     = initializer.appManager.container.get<typeof BlocksModel>(Symbols.models.blocks);
      const blocks = await bm.findAll({
        order: [['height', 'ASC']],
        where: {
          generatorPublicKey: Buffer.from('b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3', 'hex')
        },
      });
      const start  = Math.floor(c.epochTime.getTime() / 1000 + blocks[1].timestamp);
      const end    = Math.floor(c.epochTime.getTime() / 1000 + blocks[2].timestamp);
      let resp     = await  supertest(initializer.appManager.expressApp)
        .get(`/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3&start=${start}&end=${end}`)
        .expect(200);

      expect(resp.body.fees).is.eq(0);
      expect(resp.body.forged).is.eq('3000000000');
      expect(resp.body.rewards).is.eq(3000000000);

      // Check end non including second block by removing 1 second to "end" param
      resp = await  supertest(initializer.appManager.expressApp)
        .get(`/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3&start=${start}&end=${end - 1}`)
        .expect(200);

      expect(resp.body.fees).is.eq(0);
      expect(resp.body.forged).is.eq('1500000000');
      expect(resp.body.rewards).is.eq(1500000000);

      // Check start end non including first block by adding 1 "start" param
      resp = await  supertest(initializer.appManager.expressApp)
        .get(`/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3&start=${start + 1}&end=${end}`)
        .expect(200);

      expect(resp.body.fees).is.eq(0);
      expect(resp.body.forged).is.eq('1500000000');
      expect(resp.body.rewards).is.eq(1500000000);

      // Check start 0 rewards if no blocks within timeframe params
      resp = await  supertest(initializer.appManager.expressApp)
        .get(`/api/delegates/forging/getForgedByAccount?generatorPublicKey=b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3&start=${start + 1}&end=${end - 1}`)
        .expect(200);

      expect(resp.body.fees).is.eq(0);
      expect(resp.body.forged).is.eq('0');
      expect(resp.body.rewards).is.eq(0);


    });
  });

  describe('/get', () => {
    checkPubKey('publicKey', '/api/delegates/get');
    it('should return delegate object by username');
    it('should return delegate object by publicKey');
    it('should throw delegate not found if delecate is not there');
  });

  describe('/voters', () => {
    checkPubKey('publicKey', '/api/delegates/voters');
    it('should return accounts that voted for delegate');
    it('should return empty array if delegate does not exist');
    it('should return empty array if delegate have no votes');
  });

  describe('/search', () => {
    checkRequiredParam('q', '/api/delegates/search?q=haha');
    checkIntParam('limit', '/api/delegates/search?q=haha', {min: 1, max: 1000});
    it('should return delegates array matching search criteria');
    it('should honor limit parameter');
  });

  describe('/count', () => {
    checkReturnObjKeyVal('count', 101, '/api/delegates/count');
  });

  describe('/getNextForgers', () => {
    it('should return current block');
    it('should return currentBlock slot');
    it('should return current slot (time)');
    it('should return next delegates in line to forge');
  });

  describe('/forging/status', () => {
    checkPubKey('publicKey', '/api/delegates/forging/status');
    it('should disallow request from unallowed ip');
    it('should check for publicKey only if provided');
    it('should return all enabled delegates to forge');
  });
  describe('/forging/enable', () => {
    // checkRequiredParam('secret', '/api/delegates/forging/enable?secret=aaa');
    // checkPubKey('publicKey', '/api/delegates/forging/enable?secret=aaa');
    it('should disallow request from unallowed ip');
    it('should throw error if given publicKey differs from computed pk');
    it('should throw error if forging is already enabled for such account');
    it('should throw error if account is not found');
    it('should throw error if account is not a delegate');
  });
  describe('/forging/disable', () => {
    // checkRequiredParam('secret', '/api/delegates/forging/disable');
    // checkPubKey('publicKey', '/api/delegates/forging/disable?secret=aaa');
    it('should disallow request from unallowed ip');
    it('should throw error if given publicKey differs from computed pk');
    it('should throw error if forging is already disabled for such account');
    it('should throw error if account is not found');
    it('should throw error if account is not a delegate');
  });

});
