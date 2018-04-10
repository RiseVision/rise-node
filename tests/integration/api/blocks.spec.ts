import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkIntParam, checkPubKey, checkRequiredParam, checkReturnObjKeyVal } from './utils';

// tslint:disable no-unused-expression max-line-length
describe('api/blocks', () => {

  initializer.setup();

  describe('/', () => {
    describe('validation', () => {
      describe('integers', () => {
        checkIntParam('totalAmount', '/api/blocks/', { min: 0, max: '10999999991000001' });
        checkIntParam('limit', '/api/blocks/', { min: 1, max: 100 });
        checkIntParam('totalFee', '/api/blocks/', { min: 0, max: '10999999991000001' });
        checkIntParam('height', '/api/blocks/', { min: 1 });
        checkIntParam('offset', '/api/blocks/', { min: 0 });
      });
      checkPubKey('generatorPublicKey', '/api/blocks');
      it('should return an array of blocks', async () => {
        return supertest(initializer.appManager.expressApp)
          .get('/api/blocks')
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(response.body).to.haveOwnProperty('blocks');
            expect(response.body.blocks).to.be.an('array');
            expect(response.body.blocks.length).to.be.eq(1);

          });
      });
    });
  });

  describe('/get', () => {
    checkRequiredParam('id', '/api/blocks/get');
    it('should return block object', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/blocks/get?id=16985986483000875063')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body).to.haveOwnProperty('block');
          expect(response.body.block).to.be.an('object');
        });
    });
    it('should throw block not found if invalid block id is given', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/blocks/get?id=1')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Block not found');
        });
    });

  });

  describe('/getHeight', () => {
    checkReturnObjKeyVal(
      'height',
      1,
      '/api/blocks/getHeight'
    );
  });

  describe('/getBroadhash', () => {
    checkReturnObjKeyVal(
      'broadhash',
      'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
      '/api/blocks/getBroadhash'
    );
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
      return supertest(initializer.appManager.expressApp)
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
      return supertest(initializer.appManager.expressApp)
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
      return supertest(initializer.appManager.expressApp)
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
          expect(response.body.fees).to.haveOwnProperty('dapp');
        });
    });
    it('should use provided height', async () => {
      return supertest(initializer.appManager.expressApp)
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
    checkReturnObjKeyVal(
      'milestone',
      0,
      '/api/blocks/getMilestone'
    );
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
  });
  describe('/getStatus', () => {
    checkReturnObjKeyVal('nethash', 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6', '/api/blocks/getStatus');
    checkReturnObjKeyVal('broadhash', 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6', '/api/blocks/getStatus');
    checkReturnObjKeyVal('fee', 10000000, '/api/blocks/getStatus');
    checkReturnObjKeyVal('height', 1, '/api/blocks/getStatus');
    checkReturnObjKeyVal('milestone', 0, '/api/blocks/getStatus');
    checkReturnObjKeyVal('reward', 0, '/api/blocks/getStatus');
    checkReturnObjKeyVal('supply', 10999999991000000, '/api/blocks/getStatus');
  });

});
