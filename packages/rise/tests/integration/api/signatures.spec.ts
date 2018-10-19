import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkIntParam, checkReturnObjKeyVal } from './utils';

// tslint:disable no-unused-expression max-line-length
describe('api/signatures', () => {

  initializer.setup();

  describe('/fee', () => {
    checkIntParam('height', '/api/signatures/fee', { min: 1 });
    checkReturnObjKeyVal('fromHeight', 1, '/api/signatures/fee');
    checkReturnObjKeyVal('toHeight', null, '/api/signatures/fee');
    checkReturnObjKeyVal('height', 2, '/api/signatures/fee');
    checkReturnObjKeyVal('fee', 500000000, '/api/signatures/fee');
  });

  describe('[PUT] /', () => {
    it('should return method deprecated', async () => {
      return supertest(initializer.appManager.expressApp)
        .put('/api/signatures/')
        .expect(500)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Method is deprecated');
        });
    });
  });
});
