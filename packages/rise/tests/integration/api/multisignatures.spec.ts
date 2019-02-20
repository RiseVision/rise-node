import { BlocksModule } from '@risevision/core-blocks';
import { Crypto } from '@risevision/core-crypto';
import {
  MultisigSymbols,
  PostSignaturesRequest,
} from '@risevision/core-multisignature';
import { p2pSymbols } from '@risevision/core-p2p';
import { PoolManager, TXSymbols } from '@risevision/core-transactions';
import { toBufferedTransaction } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { ITransactionLogic, Symbols } from '@risevision/core-types';
import { expect } from 'chai';
import { LiskWallet } from 'dpos-offline';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import * as supertest from 'supertest';
import initializer from '../common/init';
import {
  createMultiSignTransaction,
  createRandomAccountWithFunds,
  createRandomWallet,
  enqueueAndProcessTransactions,
  getSelfTransportPeer,
} from '../common/utils';
import { checkPubKey, checkRequiredParam, checkReturnObjKeyVal } from './utils';

// tslint:disable no-unused-expression max-line-length no-identical-functions object-literal-sort-keys
describe('api/multisignatures', () => {
  initializer.setup();

  describe('/accounts', () => {
    checkRequiredParam('publicKey', '/api/multisignatures/accounts');
    checkPubKey('publicKey', '/api/multisignatures/accounts');
    checkReturnObjKeyVal(
      'accounts',
      [],
      '/api/multisignatures/accounts?publicKey=e0f1c6cca365cd61bbb01cfb454828a698fa4b7170e85a597dde510567f9dda5'
    );
    it('should return correct accounts info if account is, indeed a multisig account', async () => {
      const postsignRequest = initializer.appManager.container.getNamed<
        PostSignaturesRequest
      >(p2pSymbols.transportMethod, MultisigSymbols.p2p.postSignatures);
      const poolManager = initializer.appManager.container.get<PoolManager>(
        TXSymbols.poolManager
      );
      const blocksModule = initializer.appManager.container.get<BlocksModule>(
        Symbols.modules.blocks
      );
      const ed = initializer.appManager.container.get<Crypto>(
        Symbols.generic.crypto
      );
      const txLogic = initializer.appManager.container.get<ITransactionLogic>(
        Symbols.logic.transaction
      );
      const senderData = await createRandomAccountWithFunds(5000000000);
      const sender = senderData.wallet;
      const keys = [
        createRandomWallet(),
        createRandomWallet(),
        createRandomWallet(),
      ].sort((a, b) => b.publicKey.localeCompare(a.publicKey));

      const signedTx = createMultiSignTransaction(
        sender,
        3,
        keys.map((k) => '+' + k.publicKey)
      );
      // await initializer.rawMineBlockWithTxs([toBufferedTransaction(signedTx)]))

      await enqueueAndProcessTransactions([signedTx]);

      await initializer.rawMineBlocks(1);
      const signatures = keys.map((k) =>
        ed.sign(
          txLogic.getHash(toBufferedTransaction(signedTx), false, false),
          {
            privateKey: Buffer.from(k.privKey, 'hex'),
            publicKey: Buffer.from(k.publicKey, 'hex'),
          }
        )
      );

      await getSelfTransportPeer().makeRequest(postsignRequest, {
        body: {
          signatures: signatures.map((s) => {
            return {
              relays: 3,
              signature: s,
              transaction: signedTx.id,
            };
          }),
        },
      });
      await poolManager.processPool();
      // initializer.appManager.container.get(Symbols.generic.sequelize).options.logging = true;
      await initializer.rawMineBlocks(1);

      // initializer.appManager.container.get(Symbols.generic.sequelize).options.logging = false;
      return supertest(initializer.apiExpress)
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
    checkReturnObjKeyVal(
      'transactions',
      [],
      '/api/multisignatures/pending?publicKey=e0f1c6cca365cd61bbb01cfb454828a698fa4b7170e85a597dde510567f9dda5'
    );

    it('should have pending transactions object if any missing pending tx is available', async () => {
      const senderData = await createRandomAccountWithFunds(5000000000);
      sender = senderData.wallet;
      const keys = [
        createRandomWallet(),
        createRandomWallet(),
        createRandomWallet(),
      ];
      signedTx = createMultiSignTransaction(
        sender,
        3,
        keys.map((k) => '+' + k.publicKey)
      );
      await enqueueAndProcessTransactions([signedTx]);
      await initializer.rawMineBlocks(1);
      return supertest(initializer.apiExpress)
        .get('/api/multisignatures/pending?publicKey=' + sender.publicKey)
        .expect(200)
        .then((response) => {
          expect(Array.isArray(response.body.transactions)).to.be.true;
          expect(response.body.transactions.length).to.be.eq(1);
          expect(
            response.body.transactions[0].transaction.senderPublicKey.toString(
              'hex'
            )
          ).to.be.eq(sender.publicKey);
        });
    });

    it('should have a min, max, lifetime, signed info for each pending tx', async () => {
      const ed = initializer.appManager.container.get<Crypto>(
        Symbols.generic.crypto
      );
      const txLogic = initializer.appManager.container.get<ITransactionLogic>(
        Symbols.logic.transaction
      );
      const senderData = await createRandomAccountWithFunds(5000000000);
      sender = senderData.wallet;
      const keys = [
        createRandomWallet(),
        createRandomWallet(),
        createRandomWallet(),
      ];
      signedTx = createMultiSignTransaction(
        sender,
        3,
        keys.map((k) => '+' + k.publicKey)
      );
      await enqueueAndProcessTransactions([signedTx]);
      await initializer.rawMineBlocks(1);
      return supertest(initializer.apiExpress)
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
          const signatures = keys.map((k) =>
            ed.sign(
              txLogic.getHash(toBufferedTransaction(signedTx), false, false),
              {
                privateKey: Buffer.from(k.privKey, 'hex'),
                publicKey: Buffer.from(k.publicKey, 'hex'),
              }
            )
          );
          const postsignRequest = initializer.appManager.container.getNamed<
            PostSignaturesRequest
          >(p2pSymbols.transportMethod, MultisigSymbols.p2p.postSignatures);
          await getSelfTransportPeer().makeRequest(postsignRequest, {
            body: {
              signatures: signatures.map((s) => {
                return {
                  relays: 3,
                  signature: s,
                  transaction: signedTx.id,
                };
              }),
            },
          });

          await initializer.rawMineBlocks(1);
        });
    });
  });
});
