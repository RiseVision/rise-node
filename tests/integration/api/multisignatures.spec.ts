import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkPubKey, checkRequiredParam, checkReturnObjKeyVal } from './utils';

// tslint:disable no-unused-expression max-line-length
describe('api/multisignatures', () => {

  initializer.setup();

  describe('/accounts', () => {
    checkRequiredParam('publicKey', '/api/multisignatures/accounts');
    checkPubKey('publicKey', '/api/multisignatures/accounts');
    checkReturnObjKeyVal('accounts', [], '/api/multisignatures/accounts?publicKey=e0f1c6cca365cd61bbb01cfb454828a698fa4b7170e85a597dde510567f9dda5');
    it('should return correct accounts info if account is, indeed a multisig account');
  });

  describe('/pending', () => {
    checkRequiredParam('publicKey', '/api/multisignatures/pending');
    checkPubKey('publicKey', '/api/multisignatures/pending');
    checkReturnObjKeyVal('transactions', [], '/api/multisignatures/pending?publicKey=e0f1c6cca365cd61bbb01cfb454828a698fa4b7170e85a597dde510567f9dda5');
    it('should have pending transactions object if any missing pending tx is available');
    it('should have a min, max, lifetime, signed info for each pending tx');
  });

  describe('/sign', () => {
    it('should return deprecated', () => {
      return supertest(initializer.appManager.expressApp)
        .post('/api/multisignatures/sign')
        .expect(500)
        .then((response) => {
          expect(response.body.error).is.eq('Method is deprecated');
        });
    });
  });

  describe('[PUT] /', () => {
    it('should return deprecated', () => {
      return supertest(initializer.appManager.expressApp)
        .put('/api/multisignatures/')
        .expect(500)
        .then((response) => {
          expect(response.body.error).is.eq('Method is deprecated');
        });
    });
  });

});
