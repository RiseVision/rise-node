import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkAddress, checkPubKey } from './utils';

// tslint:disable no-unused-expression max-line-length
describe('api/accounts', () => {

  initializer.setup();

  describe('/', () => {
    checkAddress('address', '/api/accounts/');
    checkPubKey('publicKey', '/api/accounts/');
    it('should throw if no address nor pubkey is provided', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Missing required property: address or publicKey');
        });
    });
    it('should throw if both address and pubkey are provided but relates to different account', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/?publicKey=f4654563e34c93a22a90bcdb12dbe1edc42fc148cee5f21dde668748acf5f89d&address=11316019077384178848R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Account publicKey does not match address');
        });
    });
    it('should throw if account cannot be found', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Account not found');
        });
    });
    it('should return account data if all ok', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/?address=12333350760210376657R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.account).to.exist;
          expect(response.body.account).to.be.deep.eq({
            address             : '12333350760210376657R',
            balance             : '108910891000000',
            multisignatures     : [],
            publicKey           : 'f4654563e34c93a22a90bcdb12dbe1edc42fc148cee5f21dde668748acf5f89d',
            secondPublicKey     : null,
            secondSignature     : 0,
            u_multisignatures   : [],
            unconfirmedBalance  : '108910891000000',
            unconfirmedSignature: 0,
          });
        });
    });
  });

  describe('/getBalance', () => {
    it('should return error if address is not provided', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/getBalance')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain('Missing required property: address');
        });
    });
    checkAddress('address', '/api/accounts/getBalance');

    it('should return balance 0 if account is not found', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/getBalance?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.balance).to.be.eq('0');
          expect(response.body.unconfirmedBalance).to.be.eq('0');

        });
    });
    it('should return balance and unconfirmedBalance in return object', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/getBalance?address=12324540900396688540R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.balance).to.exist;
          expect(response.body.unconfirmedBalance).to.exist;
          expect(response.body.balance).to.be.a('string');
          expect(response.body.unconfirmedBalance).to.be.a('string');
          expect(response.body.balance).to.be.eq('108910891000000');
        });
    });
  });

  describe('/getPublicKey', () => {
    checkAddress('address', '/api/accounts/getPublicKey');
    it('should return error if address is not provided', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/getPublicKey')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain('Missing required property: address');
        });
    });
    it('should return Account not foundif account is not found', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/getPublicKey?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Account not found');

        });
    });
    it('should return correct publicKey and unconfirmedBalance in return object', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/getPublicKey?address=12324540900396688540R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.publicKey).to.be.eq('8ad68f938555337a7a2a0762d7a082eeaa1f6ed790dfafc5c1ca04e358b30900');
        });
    });
  });

  describe('/delegates', () => {
    checkAddress('address', '/api/accounts/delegates');
    it('should return error if address is not provided', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/delegates')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain('Missing required property: address');
        });
    });
    it('should return Account not foundif account is not found', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/delegates?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Account not found');

        });
    });
    it('should return correct voted delegates', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/accounts/delegates?address=8832350072536010884R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.an('array');
          expect(response.body.delegates).to.not.be.empty;
          expect(response.body.delegates.length).to.be.eq(1);
          expect(response.body.delegates[0].publicKey).to.be.eq('b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dca');
        });
    });
  });
});
