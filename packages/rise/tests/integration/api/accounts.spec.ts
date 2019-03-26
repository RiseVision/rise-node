import {
  AppConfig,
  IAccountsModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-types';
import { expect } from 'chai';
import { IKeypair, Rise } from 'dpos-offline';
import * as supertest from 'supertest';
import { toNativeTx } from '../../../../core-transactions/tests/unit/utils/txCrafter';
import initializer from '../common/init';
import {
  confirmTransactions,
  createRandomAccountsWithFunds,
  createRandomWallet,
  createSecondSignTransactionV1,
  createSendTransactionV1,
  findDelegateByUsername,
} from '../common/utils';
import { checkAddress, checkIntParam, checkPubKey } from './utils';

// tslint:disable no-unused-expression max-line-length no-big-function object-literal-sort-keys no-identical-functions
describe('api/accounts', () => {
  initializer.setup();
  initializer.autoRestoreEach();

  describe('/', () => {
    checkAddress('address', '/api/accounts/');
    // checkPubKey('publicKey', '/api/accounts/');

    it('should throw if no address nor pubkey is provided', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq(
            'Missing required property: address or publicKey'
          );
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
            address: '12333350760210376657R',
            balance: '108910891000000',
            // multisignatures: null,
            // publicKey:
            //   'f4654563e34c93a22a90bcdb12dbe1edc42fc148cee5f21dde668748acf5f89d',
            secondPublicKey: null,
            secondSignature: 0,
            // u_multisignatures: null,
            unconfirmedBalance: '108910891000000',
            unconfirmedSignature: 0,
          });
        });
    });
    it('should return second signature data', async () => {
      const [{ account }] = await createRandomAccountsWithFunds(1, 1e10);
      const tx = await createSecondSignTransactionV1(
        1,
        account,
        createRandomWallet().publicKey
      );
      const address = Rise.calcAddress(account.publicKey);
      return supertest(initializer.apiExpress)
        .get(`/api/accounts/?address=${address}`)
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.account).to.exist;
          expect(response.body.account).to.be.deep.eq({
            address,
            balance: '9500000000',
            // multisignatures: null,
            // publicKey: account.publicKey,
            secondPublicKey: (tx.asset as any).signature.publicKey.toString(
              'hex'
            ),
            secondSignature: 1,
            // u_multisignatures: null,
            unconfirmedBalance: '9500000000',
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
          expect(response.body.error).to.contain(
            'Missing required property: address'
          );
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

  describe('/votes', () => {
    checkAddress('address', '/api/accounts/votes');
    it('should return error if address is not provided', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/votes')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain(
            'Missing required property: address'
          );
        });
    });

    it('should return empty array if account does not exists', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/votes?address=1R')
        .expect(200)
        .then((response) => {
          expect(response.body).deep.eq({ success: true, votes: [] });
        });
    });

    it('should return correct voted delegates', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/accounts/votes?address=8832350072536010884R')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.votes).deep.eq(['genesisDelegate34']);
        });
    });
  });

  describe('/top', () => {
    beforeEach(async function() {
      this.timeout(5000);
      const txs = [];
      const accModule = initializer.appManager.container.get<IAccountsModule>(
        Symbols.modules.accounts
      );
      const systemModule = initializer.appManager.container.get<ISystemModule>(
        Symbols.modules.system
      );
      // Create 101 txs so that genesis1 has 101satoshi , genesis2 100 ... genesisN 101-N+1
      for (let i = 0; i < 101; i++) {
        const del = findDelegateByUsername(`genesisDelegate${i + 1}`);
        const lw = Rise.deriveKeypair(del.secret);
        const account = await accModule.getAccount({ address: del.address });

        const transaction = toNativeTx(
          await createSendTransactionV1(
            0,
            account.balance -
              systemModule.getFees().fees.send -
              BigInt(101 - i),
            lw,
            '1R',
            i
          )
        );
        txs.push(transaction);
      }
      await confirmTransactions(txs, false);
    });
    checkIntParam('limit', '/api/accounts/top', { min: 0, max: 100 });
    checkIntParam('offset', '/api/accounts/top', { min: 0 });
    it('should return error if appConfig.topAccounts is false', async () => {
      const ac = initializer.appManager.container.get<AppConfig>(
        Symbols.generic.appConfig
      );
      ac.topAccounts = false;
      await supertest(initializer.apiExpress)
        .get('/api/accounts/top')
        .expect(403);
    });
    it('should limit topAccounts response to 100 results with 0 offset when no params', async () => {
      const ac = initializer.appManager.container.get<AppConfig>(
        Symbols.generic.appConfig
      );
      ac.topAccounts = true;
      const { body } = await supertest(initializer.apiExpress)
        .get('/api/accounts/top')
        .expect(200);
      expect(body.accounts.length).eq(100);
      // just check first as the sequence check is done in the next test
      expect(body.accounts[0].address).eq('1R');
    });
    it('should return accounts in ordered by balance honoring limits and offset', async () => {
      const ac = initializer.appManager.container.get<AppConfig>(
        Symbols.generic.appConfig
      );
      ac.topAccounts = true;
      for (let i = 0; i < 10; i++) {
        const { body } = await supertest(initializer.apiExpress)
          .get(`/api/accounts/top?limit=${10}&offset=${i * 10 + 1}`)
          .expect(200);
        const { accounts } = body;
        expect(accounts.length).to.be.eq(10);
        for (let j = 0; j < 10; j++) {
          expect(accounts[j].balance).eq(`${101 - i * 10 - j}`);
          expect(accounts[j].address).be.eq(
            findDelegateByUsername(`genesisDelegate${i * 10 + j + 1}`).address
          );
        }
      }
    });
  });
});
