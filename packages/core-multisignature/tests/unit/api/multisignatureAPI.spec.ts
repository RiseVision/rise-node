import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as filterObject from 'filter-object';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import {
  IAccountsModule,
  ITransactionLogic,
  ITransactionPool,
  Symbols,
} from '@risevision/core-interfaces';
import { Accounts2MultisignaturesModel } from '../../../src/models';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import {
  AccountsModelWithMultisig,
  MultiSignaturesApi,
  MultisigSymbols,
} from '../../../src';
import { ModelSymbols } from '@risevision/core-models';
import { APISymbols } from '@risevision/core-apis';
import { LiskWallet } from 'dpos-offline';
import { TXSymbols } from '@risevision/core-transactions';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('apis/multisignatureAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: MultiSignaturesApi;
  let result: any;
  let accountsModule: IAccountsModule;
  let account1: AccountsModelWithMultisig;
  let account2: AccountsModelWithMultisig;
  let account3: AccountsModelWithMultisig;
  let account4: AccountsModelWithMultisig;
  let account5: AccountsModelWithMultisig;
  let account6: AccountsModelWithMultisig;
  let AccountsModel: typeof AccountsModelWithMultisig;
  let tx1: any;
  let tx2: any;
  let tx3: any;
  let tx4: any;
  let accounts2multisignaturesModel: typeof Accounts2MultisignaturesModel;
  let transactionLogic: ITransactionLogic;
  let txPool: ITransactionPool;
  let accounts: LiskWallet[];
  let getAccountsStub: SinonStub;
  let genAddressStub: SinonStub;
  let verifySignatureStub: SinonStub;
  let getAccountStub: SinonStub;
  let findAllStub: SinonStub;
  beforeEach(async () => {
    container = await createContainer([
      'core-multisignature',
      'core',
      'core-helpers',
      'core-crypto',
    ]);

    sandbox = sinon.createSandbox();
    instance = container.getNamed(APISymbols.class, MultisigSymbols.api);
    accounts2multisignaturesModel = container.getNamed(
      ModelSymbols.model,
      MultisigSymbols.models.accounts2Multi
    );
    accountsModule = container.get(Symbols.modules.accounts);
    AccountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );

    accounts = new Array(6)
      .fill(null)
      .map((_, idx) => new LiskWallet(`account${idx + 1}`, 'R'));
    account1 = new AccountsModel({
      address: accounts[0].address,
      balance: 100,
      publicKey: Buffer.from(accounts[0].publicKey, 'hex'),
      id: 1,
      multilifetime: 101,
      multimin: 2,
      multisignatures: [
        accounts[1].publicKey,
        accounts[2].publicKey,
        accounts[5].publicKey,
      ],
    } as any);
    account2 = new AccountsModel({
      address: accounts[1].address,
      balance: 200,
      publicKey: Buffer.from(accounts[1].publicKey, 'hex'),
      id: 2,
      multilifetime: 201,
      multimin: 202,
      multisignatures: [
        accounts[4].publicKey,
        accounts[5].publicKey,
        accounts[0].publicKey,
      ],
    } as any);
    account3 = new AccountsModel({
      id: 3,
      address: accounts[2].address,
      publicKey: Buffer.from(accounts[2].publicKey, 'hex'),
      balance: 300,
      multilifetime: 301,
      multimin: 302,
      multisignatures: [
        accounts[1].publicKey,
        accounts[5].publicKey,
        accounts[0].publicKey,
      ],
    } as any);
    account4 = new AccountsModel({
      id: 4,
      address: accounts[3].address,
      publicKey: Buffer.from(accounts[3].publicKey, 'hex'),
      balance: 400,
    } as any);
    account5 = new AccountsModel({
      address: accounts[4].address,
      publicKey: Buffer.from(accounts[4].publicKey, 'hex'),
      u_multilifetime: 20,
      u_multimin: 10,
      u_multisignatures: [
        accounts[1].publicKey,
        accounts[2].publicKey,
        accounts[3].publicKey,
      ],
    } as any);
    account6 = new AccountsModel({
      address: accounts[5].address,
      publicKey: Buffer.from(accounts[5].publicKey, 'hex'),
      multilifetime: 200,
      multimin: 100,
      u_multisignatures: undefined,
    } as any);
    findAllStub = sandbox
      .stub(AccountsModel, 'findAll')
      .resolves([account1, account2, account3, account4, account5, account6]);
    getAccountsStub = sandbox.stub(accountsModule, 'getAccounts');
    genAddressStub = sandbox
      .stub(accountsModule, 'generateAddressByPublicKey')
      .returns(1000);
    getAccountsStub.onFirstCall().resolves([account1, account2]);
    getAccountsStub.onSecondCall().resolves([account3]);
    getAccountsStub.onThirdCall().resolves([account4]);
    getAccountStub = sandbox.stub(accountsModule, 'getAccount');

    getAccountStub.onFirstCall().resolves(account5);
    getAccountStub.onSecondCall().resolves(account6);

    txPool = container.get(TXSymbols.pool);

    tx1 = {
      id: 1,
      senderId: account1.address,
      type: 4,
      fee: 1,
      amount: 0,
      timestamp: 10,
      senderPublicKey: account1.publicKey,
      signatures: ['aaa'],
      asset: { multisignature: { keysgroup: [] } },
    };
    tx2 = {
      id: 2,
      senderId: account2.address,
      type: 4,
      fee: 2,
      amount: 0,
      timestamp: 10,
      senderPublicKey: account2.publicKey,
      asset: { multisignature: { keysgroup: [] } },
    };
    tx3 = {
      id: 3,
      senderId: account1.address,
      type: 4,
      fee: 3,
      amount: 0,
      timestamp: 10,
      senderPublicKey: account1.publicKey,
      asset: { multisignature: { keysgroup: [] } },
    };
    tx4 = {
      id: 4,
      senderId: account3.address,
      type: 0,
      fee: 4,
      amount: 0,
      timestamp: 10,
      senderPublicKey: account3.publicKey,
    };
    sandbox.stub(txPool.pending, 'txList').returns([tx1, tx2, tx3, tx4]);

    transactionLogic = container.get(Symbols.logic.transaction);
    verifySignatureStub = sandbox
      .stub(transactionLogic, 'verifySignature')
      .returns(true);
  });
  afterEach(async () => {
    sandbox.restore();
  });

  describe('getAccounts()', () => {
    it('should return an array of accounts', async () => {
      sandbox
        .stub(accounts2multisignaturesModel, 'findAll')
        .resolves([{ accountId: '1' }, { accountId: '2' }, { accountId: '3' }]);
      result = await instance.getAccounts({
        publicKey: new LiskWallet('meow').publicKey,
      });

      const accounts = [];
      accounts.push(
        filterObject(
          {
            ...account1.toPOJO(),
            multisigaccounts: [
              filterObject(account3.toPOJO(), '{address,balance,publicKey}'),
            ],
          },
          '!publicKey'
        )
      );
      accounts.push(
        filterObject(
          {
            ...account2.toPOJO(),
            multisigaccounts: [
              filterObject(account4.toPOJO(), '{address,balance,publicKey}'),
            ],
          },
          '!publicKey'
        )
      );
      expect(result).to.deep.equal({ accounts });

      expect(getAccountsStub.callCount).to.equal(3);
      expect(getAccountsStub.args[0][0]).to.deep.equal({
        address: { $in: ['1', '2', '3'] },
        sort: {
          balance: -1,
          publicKey: -1,
        },
      });
      expect(getAccountsStub.args[1][0]).to.deep.equal({
        address: { $in: [1000, 1000, 1000] },
        sort: {
          balance: -1,
          publicKey: -1,
        },
      });
      expect(getAccountsStub.args[1][0]).to.deep.equal({
        address: { $in: [1000, 1000, 1000] },
        sort: {
          balance: -1,
          publicKey: -1,
        },
      });
    });
  });

  describe('getPending()', () => {
    it('should return an object with pending transactions', async () => {
      result = await instance.getPending({ publicKey: account3.hexPublicKey });
      expect(result).to.deep.equal({
        transactions: [
          {
            lifetime: 101,
            max: 0,
            min: 2,
            signed: true /* stub */,
            transaction: {
              ...tx1,
              senderPublicKey: tx1.senderPublicKey.toString('hex'),
            },
          },
          {
            lifetime: 101,
            max: 0,
            min: 2,
            signed: false /* nosignatures*/,
            transaction: {
              ...tx3,
              senderPublicKey: tx3.senderPublicKey.toString('hex'),
            },
          },
          {
            lifetime: 301,
            max: 0,
            min: 302,
            signed: true,
            transaction: {
              ...tx4,
              senderPublicKey: tx4.senderPublicKey.toString('hex'),
            },
          },
        ],
      });
    });

    it('should match also for multisig accounts pubkey', async () => {
      tx2.type = 0;
      tx2.signatures = [accounts[4].getSignatureOfTransaction(tx4)];
      result = await instance.getPending({ publicKey: accounts[4].publicKey });
      expect(result).to.be.deep.eq({
        transactions: [
          {
            lifetime: account2.multilifetime,
            max: 0,
            min: account2.multimin,
            signed: true,
            transaction: { ...tx2, senderPublicKey: account2.hexPublicKey },
          },
        ],
      });
      tx2.signatures = [];
      result = await instance.getPending({ publicKey: accounts[4].publicKey });
      expect(result).to.be.deep.eq({
        transactions: [
          {
            lifetime: account2.multilifetime,
            max: 0,
            min: account2.multimin,
            signed: false,
            transaction: { ...tx2, senderPublicKey: account2.hexPublicKey },
          },
        ],
      });
    });

    it('Sender not found', async () => {
      findAllStub.resolves([account1, account2]);
      await expect(
        instance.getPending({ publicKey: account3.hexPublicKey })
      ).to.be.rejectedWith(`Account ${account3.address} not found in db`);
    });
  });
});
