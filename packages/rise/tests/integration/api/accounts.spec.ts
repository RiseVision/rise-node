import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkAddress, checkIntParam, checkPubKey } from './utils';
import {
  confirmTransactions, createRandomAccountsWithFunds, createRandomWallet, createSecondSignTransaction,
  createSendTransaction,
  easyCreateMultiSignAccount,
  findDelegateByUsername
} from '../common/utils';
import { LiskWallet } from 'dpos-offline';
import { toBufferedTransaction } from '../../../../core-transactions/tests/unit/utils/txCrafter';
import { AppConfig } from '@risevision/core-types';
import { IAccountsModule, ISystemModule, Symbols } from '@risevision/core-interfaces';

// tslint:disable no-unused-expression max-line-length
describe('api/accounts', () => {

  initializer.setup();
  initializer.autoRestoreEach();

  describe('/', () => {
    checkAddress('address', '/api/accounts/');
    checkPubKey('publicKey', '/api/accounts/');

    it('should throw if no address nor pubkey is provided', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Missing required property: address or publicKey');
        });
    });

    it('should throw if both address and pubkey are provided but relates to different account', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/?publicKey=f4654563e34c93a22a90bcdb12dbe1edc42fc148cee5f21dde668748acf5f89d&address=11316019077384178848R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Account publicKey does not match address');
        });
    });

    it('should throw if account cannot be found', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Account not found');
        });
    });

    it('should return account data if all ok', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/?address=12333350760210376657R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.account).to.exist;
          expect(response.body.account).to.be.deep.eq({
            address             : '12333350760210376657R',
            balance             : '108910891000000',
            multisignatures     : null,
            publicKey           : 'f4654563e34c93a22a90bcdb12dbe1edc42fc148cee5f21dde668748acf5f89d',
            secondPublicKey     : null,
            secondSignature     : 0,
            u_multisignatures   : null,
            unconfirmedBalance  : '108910891000000',
            unconfirmedSignature: 0,
          });
        });
    });
    it('should return multisig data', async () => {
      const {wallet, keys } = await easyCreateMultiSignAccount(4, 3);
      return supertest(initializer.apiExpress)
        .get(`/api/accounts/?address=${wallet.address}`)
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.account).to.exist;
          expect(response.body.account).to.be.deep.eq({
            address             : wallet.address,
            balance             : '99500000000',
            multisignatures     : keys.map((k) => k.publicKey),
            publicKey           : wallet.publicKey,
            secondPublicKey     : null,
            secondSignature     : 0,
            u_multisignatures   : keys.map((k) => k.publicKey),
            unconfirmedBalance  : '99500000000',
            unconfirmedSignature: 0,
          });
        });
    });
    it('should return second signature data', async () => {
      const [{account}] = await createRandomAccountsWithFunds(1, 1e10);
      const tx = await createSecondSignTransaction(1, account, createRandomWallet().publicKey);
      return supertest(initializer.apiExpress)
        .get(`/api/accounts/?address=${account.address}`)
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.account).to.exist;
          expect(response.body.account).to.be.deep.eq({
            address             : account.address,
            balance             : '9500000000',
            multisignatures     : null,
            publicKey           : account.publicKey,
            secondPublicKey     : (tx.asset as any).signature.publicKey,
            secondSignature     : 1,
            u_multisignatures   : null,
            unconfirmedBalance  : '9500000000',
            unconfirmedSignature: 0,
          });
        });
    });
  });

  describe('/getBalance', () => {
    it('should return error if address is not provided', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/getBalance')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain('Missing required property: address');
        });
    });
    checkAddress('address', '/api/accounts/getBalance');

    it('should return balance 0 if account is not found', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/getBalance?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.balance).to.be.eq('0');
          expect(response.body.unconfirmedBalance).to.be.eq('0');

        });
    });
    it('should return balance and unconfirmedBalance in return object', async () => {
      return supertest(initializer.apiExpress)
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
      return supertest(initializer.apiExpress)
        .get('/api/accounts/getPublicKey')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain('Missing required property: address');
        });
    });

    it('should return Account not foundif account is not found', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/getPublicKey?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Account not found');

        });
      });

    it('should return correct publicKey and unconfirmedBalance in return object', async () => {
      return supertest(initializer.apiExpress)
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
      return supertest(initializer.apiExpress)
        .get('/api/accounts/delegates')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain('Missing required property: address');
        });
    });

    it('should return Account not foundif account is not found', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/delegates?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Account not found');

        });
    });

    it('should return correct voted delegates', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/delegates?address=8832350072536010884R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.an('array');
          expect(response.body.delegates).to.not.be.empty;
          expect(response.body.delegates.length).to.be.eq(1);
          expect(response.body.delegates[0].publicKey).to.be.eq('b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dca');
          expect(response.body.delegates[0]).to.be.deep.eq({
            username: 'genesisDelegate34',
            address: '8832350072536010884R',
            publicKey: 'b2778387b9ee350bf5f5d770baeebcb5ce859080f6ed15f33d285fec830a0dca',
            vote: 108910891000000,
            producedblocks: 0,
            missedblocks: 1,
            rate: 73,
            rank: 73,
            approval: 0.99,
            productivity: 0,
          });
        });
    });
  });

  describe('/top', () => {
    beforeEach(async function () {
      this.timeout(5000);
      const txs = [];
      const accModule = initializer.appManager.container.get<IAccountsModule>(Symbols.modules.accounts);
      const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
      // Create 101 txs so that genesis1 has 101satoshi , genesis2 100 ... genesisN 101-N+1
      for (let i = 0; i < 101; i++) {
        const del   = findDelegateByUsername(`genesisDelegate${i + 1}`);
        const lw    = new LiskWallet(del.secret, 'R');
        const account = await accModule.getAccount({address: del.address});

        const transaction = toBufferedTransaction(await createSendTransaction(
          0,
          account.balance - systemModule.getFees().fees.send - (101 - i),
          lw,
          '1R',
          {timestamp: i})
        );
        transaction.senderId = del.address;
        txs.push(transaction);
      }
      await confirmTransactions(txs, false);
    });
    checkIntParam('limit', '/api/accounts/top', {min: 0, max: 100});
    checkIntParam('offset', '/api/accounts/top', {min: 0});
    it('should return error if appConfig.topAccounts is false', async () => {
      const ac = initializer.appManager.container.get<AppConfig>(Symbols.generic.appConfig);
      ac.topAccounts = false;
      await supertest(initializer.apiExpress)
        .get('/api/accounts/top')
        .expect(403);
    });
    it('should limit topAccounts response to 100 results with 0 offset when no params', async () => {
      const ac = initializer.appManager.container.get<AppConfig>(Symbols.generic.appConfig);
      ac.topAccounts = true;
      const {body}     = await supertest(initializer.apiExpress)
        .get(`/api/accounts/top`)
        .expect(200);
      expect(body.accounts.length).eq(100);
      // just check first as the sequence check is done in the next test
      expect(body.accounts[0].address).eq('1R');
    });
    it('should return accounts in ordered by balance honoring limits and offset', async () => {

      const ac = initializer.appManager.container.get<AppConfig>(Symbols.generic.appConfig);
      ac.topAccounts = true;
      for (let i = 0; i < 10; i++) {
        const {body}     = await supertest(initializer.apiExpress)
          .get(`/api/accounts/top?limit=${10}&offset=${i * 10 + 1}`)
          .expect(200);
        const {accounts} = body;
        expect(accounts.length).to.be.eq(10);
        for (let j = 0; j < 10; j++) {
          expect(accounts[j].balance).eq(101 - (i * 10) - j);
          expect(accounts[j].address).be
            .eq(findDelegateByUsername(`genesisDelegate${i * 10 + j + 1}`).address);
        }
      }

    });

  });
});
