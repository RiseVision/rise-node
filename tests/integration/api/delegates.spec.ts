import initializer from '../common/init';
import { checkEnumParam, checkIntParam, checkPubKey, checkRequiredParam, checkReturnObjKeyVal } from './utils';
import * as supertest from 'supertest';
import * as chai from 'chai';
import * as chaiSorted from 'chai-sorted';
chai.use(chaiSorted);

const {expect} = chai;
const delegates = require('../genesisDelegates.json');

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
            expect(response.body.delegates).to.be.ascendingBy(sortKey);
          });
      });
      it('should honor orderBy ' + sortKey + ' desc param', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/delegates/?orderBy=' + sortKey + ':desc')
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(Array.isArray(response.body.delegates)).to.be.true;
            expect(response.body.delegates).to.be.descendingBy(sortKey);
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
    checkReturnObjKeyVal('height', 2, '/api/delegates/fee');
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
    it('should calculate the total forged amount');
    it('should calculate the forged amount accounting start and end');
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
    checkIntParam('limit', '/api/delegates/search?q=haha', { min: 1, max: 1000 });
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
