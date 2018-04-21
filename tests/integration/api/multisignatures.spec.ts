import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkPubKey, checkRequiredParam, checkReturnObjKeyVal } from './utils';
import {
  createMultiSignTransaction, createRandomAccountWithFunds, createRandomWallet
} from '../common/utils';
import { Symbols } from '../../../src/ioc/symbols';

// tslint:disable no-unused-expression max-line-length
describe('api/multisignatures', () => {

  initializer.setup();

  describe('/accounts', () => {
    checkRequiredParam('publicKey', '/api/multisignatures/accounts');
    checkPubKey('publicKey', '/api/multisignatures/accounts');
    checkReturnObjKeyVal('accounts', [], '/api/multisignatures/accounts?publicKey=e0f1c6cca365cd61bbb01cfb454828a698fa4b7170e85a597dde510567f9dda5');
    it('should return correct accounts info if account is, indeed a multisig account', async () => {
      const txModule = initializer.appManager.container.get(Symbols.modules.transactions);
      const transportModule = initializer.appManager.container.get(Symbols.modules.transport);
      const ed = initializer.appManager.container.get(Symbols.helpers.ed);
      const txLogic = initializer.appManager.container.get(Symbols.logic.transaction);
      const senderData = await createRandomAccountWithFunds(5000000000);
      const sender = senderData.wallet;
      const keys = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
      const signedTx = createMultiSignTransaction(sender, 3, keys.map((k) => '+' + k.publicKey));
      await txModule.receiveTransactions([signedTx], false, false);
      await initializer.rawMineBlocks(1);
      const signatures = keys.map((k) => ed.sign(
        txLogic.getHash(signedTx, true, false),
        {
          privateKey: Buffer.from(k.privKey, 'hex'),
          publicKey : Buffer.from(k.publicKey, 'hex'),
        }
      ).toString('hex'));

      await transportModule.receiveSignatures(signatures.map((sig) => ({
        signature  : sig,
        transaction: signedTx.id,
      })));

      await initializer.rawMineBlocks(1);
      return supertest(initializer.appManager.expressApp)
        .get('/api/multisignatures/accounts?publicKey=' + keys[0].publicKey)
        .expect(200)
        .then((response) => {
          expect(Array.isArray(response.body.accounts)).is.true;
          expect(response.body.accounts[0].multimin).is.eq(3);
          expect(response.body.accounts[0].address).is.eq(sender.address);
        });
    });
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
