import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkPubKey, checkRequiredParam, checkReturnObjKeyVal } from './utils';
import {
  createMultiSignTransaction, createRandomAccountWithFunds, createRandomWallet, enqueueAndProcessBundledTransaction
} from '../common/utils';
import { Symbols } from '../../../src/ioc/symbols';
import { LiskWallet } from 'dpos-offline';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { ITransactionsModule, ITransportModule } from '../../../src/ioc/interfaces/modules';
import { toBufferedTransaction } from '../../utils/txCrafter';
import { Ed } from '../../../src/helpers';
import { ITransactionLogic, ITransactionPoolLogic } from '../../../src/ioc/interfaces/logic';

// tslint:disable no-unused-expression max-line-length
describe('api/multisignatures', () => {

  initializer.setup();

  describe('/accounts', () => {
    checkRequiredParam('publicKey', '/api/multisignatures/accounts');
    checkPubKey('publicKey', '/api/multisignatures/accounts');
    checkReturnObjKeyVal('accounts', [], '/api/multisignatures/accounts?publicKey=e0f1c6cca365cd61bbb01cfb454828a698fa4b7170e85a597dde510567f9dda5');
    it('should return correct accounts info if account is, indeed a multisig account', async () => {
      const txModule = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
      const txPool = initializer.appManager.container.get<ITransactionPoolLogic>(Symbols.logic.transactionPool);
      const transportModule = initializer.appManager.container.get<ITransportModule>(Symbols.modules.transport);
      const ed = initializer.appManager.container.get<Ed>(Symbols.helpers.ed);
      const txLogic = initializer.appManager.container.get<ITransactionLogic>(Symbols.logic.transaction);
      const senderData = await createRandomAccountWithFunds(5000000000);
      const sender = senderData.wallet;
      const keys = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
      const signedTx = createMultiSignTransaction(sender, 3, keys.map((k) => '+' + k.publicKey));
      // await initializer.rawMineBlockWithTxs([toBufferedTransaction(signedTx)]))

      await txModule.processUnconfirmedTransaction(toBufferedTransaction(signedTx), false);
      await txPool.processBundled();
      await txModule.fillPool();

      await initializer.rawMineBlocks(1);
      const signatures = keys.map((k) => ed.sign(
        txLogic.getHash(toBufferedTransaction(signedTx), false, false),
        {
          privateKey: Buffer.from(k.privKey, 'hex'),
          publicKey : Buffer.from(k.publicKey, 'hex'),
        }
      ).toString('hex'));

      await transportModule.receiveSignatures(signatures.map((sig) => ({
        signature  : sig,
        transaction: signedTx.id,
      })));
      // initializer.appManager.container.get(Symbols.generic.sequelize).options.logging = true;
      await initializer.rawMineBlocks(1);
      // initializer.appManager.container.get(Symbols.generic.sequelize).options.logging = false;
      return supertest(initializer.appManager.expressApp)
        .get('/api/multisignatures/accounts?publicKey=' + keys[0].publicKey)
        .expect(200)
        .then((response) => {
          expect(Array.isArray(response.body.accounts)).is.true;
          expect(response.body.accounts.length).is.eq(1);
          expect(response.body.accounts[0]).to.be.deep.eq({
            address: sender.address,
            balance: 5000000000 - 500000000,
            multisigaccounts: keys.map((k) => {
              return {
                address: k.address,
                balance: 0,
                publicKey: k.publicKey,
              };
            }),
            multilifetime: 24,
            multimin: 3,
            multisignatures: keys.map((k) => k.publicKey),
          });
        });
    });
  });

  describe('/pending', () => {
    let sender: LiskWallet;
    let signedTx: ITransaction;
    checkRequiredParam('publicKey', '/api/multisignatures/pending');
    checkPubKey('publicKey', '/api/multisignatures/pending');
    checkReturnObjKeyVal('transactions', [], '/api/multisignatures/pending?publicKey=e0f1c6cca365cd61bbb01cfb454828a698fa4b7170e85a597dde510567f9dda5');

    it('should have pending transactions object if any missing pending tx is available', async () => {
      const txModule = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
      const senderData = await createRandomAccountWithFunds(5000000000);
      sender = senderData.wallet;
      const keys = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
      signedTx = createMultiSignTransaction(sender, 3, keys.map((k) => '+' + k.publicKey));
      await enqueueAndProcessBundledTransaction(signedTx);
      //await txModule.processUnconfirmedTransaction(toBufferedTransaction(signedTx), false, false);
      await initializer.rawMineBlocks(1);
      return supertest(initializer.appManager.expressApp)
        .get('/api/multisignatures/pending?publicKey=' + sender.publicKey)
        .expect(200)
        .then((response) => {
          expect(Array.isArray(response.body.transactions)).to.be.true;
          expect(response.body.transactions.length).to.be.eq(1);
          expect(response.body.transactions[0].transaction.senderPublicKey.toString('hex')).to.be.eq(sender.publicKey);
        });

    });

    it('should have a min, max, lifetime, signed info for each pending tx', async () => {
      const txModule = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
      const transportModule = initializer.appManager.container.get<ITransportModule>(Symbols.modules.transport);
      const ed = initializer.appManager.container.get<Ed>(Symbols.helpers.ed);
      const txLogic = initializer.appManager.container.get<ITransactionLogic>(Symbols.logic.transaction);
      const senderData = await createRandomAccountWithFunds(5000000000);
      sender = senderData.wallet;
      const keys = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
      signedTx = createMultiSignTransaction(sender, 3, keys.map((k) => '+' + k.publicKey));
      await enqueueAndProcessBundledTransaction(signedTx);
      //await txModule.processUnconfirmedTransaction(toBufferedTransaction(signedTx), false, false);
      await initializer.rawMineBlocks(1);
      return supertest(initializer.appManager.expressApp)
        .get('/api/multisignatures/pending?publicKey=' + sender.publicKey)
        .expect(200)
        .then(async (response) => {
          expect(Array.isArray(response.body.transactions)).to.be.true;
          response.body.transactions.forEach((txObj) => {
            expect(txObj.lifetime).to.exist;
            expect(txObj.max).to.exist;
            expect(txObj.min).to.exist;
            expect(txObj.signed).to.exist;
            expect(txObj.transaction).to.exist;
          });
          const signatures = keys.map((k) => ed.sign(
            txLogic.getHash(toBufferedTransaction(signedTx), false, false),
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
        });
    });
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
