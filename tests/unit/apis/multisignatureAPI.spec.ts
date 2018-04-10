import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { MultisignatureAPI } from '../../../src/apis/multisignatureAPI';
import { Symbols } from '../../../src/ioc/symbols';
import {
  AccountsModuleStub,
  DbStub,
  TransactionLogicStub,
  TransactionsModuleStub
} from '../../stubs';
import { createContainer } from '../../utils/containerCreator';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('apis/multisignatureAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: any;
  let result: any;
  let dbStub: DbStub;
  let accountsModuleStub: AccountsModuleStub;
  let account1: any;
  let account2: any;
  let account3: any;
  let account4: any;
  let account5: any;
  let account6: any;
  let transactionsModuleStub: TransactionsModuleStub;
  let transactionLogicStub: TransactionLogicStub;
  let tx1: any;
  let tx2: any;
  let tx3: any;

  beforeEach(() => {
    container = createContainer();
    sandbox = sinon.sandbox.create();
    container
      .bind(Symbols.api.multisignatures)
      .to(MultisignatureAPI)
      .inSingletonScope();

    dbStub = container.get(Symbols.generic.db);
    dbStub.enqueueResponse('one', Promise.resolve({ accountIds: [1, 2, 3] }));

    account1 = {
      address: 'aaa',
      balance: 100,
      id: 1,
      multilifetime: 101,
      multimin: 102,
      multisignatures: [10, 20, 30],
    };
    account2 = {
      address: 'bbb',
      balance: 200,
      id: 2,
      multilifetime: 201,
      multimin: 202,
      multisignatures: [40, 50, 60],
    };
    account3 = { id: 3, address: 'ccc', publicKey: 'c3c3c3', balance: 300 };
    account4 = { id: 4, address: 'ddd', publicKey: 'c4c4c4', balance: 400 };
    account5 = {
      u_multimin: 10,
      u_multilifetime: 20,
      u_multisignatures: ['a', 'b', 'c'],
    };
    account6 = {
      multimin: 100,
      multilifetime: 200,
      u_multisignatures: undefined,
    };

    accountsModuleStub = container.get(Symbols.modules.accounts);
    accountsModuleStub.stubs.generateAddressByPublicKey.returns(1000);
    accountsModuleStub.enqueueResponse(
      'getAccounts',
      Promise.resolve([account1, account2])
    );
    accountsModuleStub.enqueueResponse(
      'getAccounts',
      Promise.resolve([account3])
    );
    accountsModuleStub.enqueueResponse(
      'getAccounts',
      Promise.resolve([account4])
    );

    accountsModuleStub.enqueueResponse('getAccount', Promise.resolve(account5));

    accountsModuleStub.enqueueResponse('getAccount', Promise.resolve(account6));

    transactionsModuleStub = container.get(Symbols.modules.transactions);
    tx1 = { id: 1, senderPublicKey: 100, signatures: ['aaa'] };
    tx2 = { id: 2, senderPublicKey: 101 };
    tx3 = { id: 3, senderPublicKey: 100 };
    transactionsModuleStub.enqueueResponse('getMultisignatureTransactionList', [
      tx1,
      tx2,
      tx3,
    ]);

    transactionLogicStub = container.get(Symbols.logic.transaction);
    transactionLogicStub.stubs.verifySignature.returns(true);

    instance = container.get(Symbols.api.multisignatures);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('getAccounts()', () => {
    it('success', async () => {
      result = await instance.getAccounts({ publicKey: '123' });
      const accounts = [];
      accounts.push({ ...account1, ...{ multisigaccounts: [account3] } });
      accounts.push({ ...account2, ...{ multisigaccounts: [account4] } });
      expect(result).to.deep.equal({ accounts });
      expect(dbStub.stubs.one.calledOnce).to.be.true;
      expect(dbStub.stubs.one.args[0][0]).to.equal(
        'SELECT ARRAY_AGG("accountId") AS "accountIds" FROM mem_accounts2multisignatures WHERE "dependentId" = ${publicKey}'
      );
      expect(dbStub.stubs.one.args[0][1]).to.deep.equal({ publicKey: '123' });
      expect(accountsModuleStub.stubs.getAccounts.callCount).to.equal(3);
      expect(accountsModuleStub.stubs.getAccounts.args[0][0]).to.deep.equal({
        address: { $in: [1, 2, 3] },
        sort: 'balance',
      });
      expect(accountsModuleStub.stubs.getAccounts.args[0][1]).to.deep.equal([
        'address',
        'balance',
        'multisignatures',
        'multilifetime',
        'multimin',
      ]);
      expect(accountsModuleStub.stubs.getAccounts.args[1][0]).to.deep.equal({
        address: { $in: [1000, 1000, 1000] },
      });
      expect(accountsModuleStub.stubs.getAccounts.args[1][1]).to.deep.equal([
        'address',
        'publicKey',
        'balance',
      ]);
      expect(accountsModuleStub.stubs.getAccounts.args[1][0]).to.deep.equal({
        address: { $in: [1000, 1000, 1000] },
      });
      expect(accountsModuleStub.stubs.getAccounts.args[1][1]).to.deep.equal([
        'address',
        'publicKey',
        'balance',
      ]);
    });
  });

  describe('getPending()', () => {
    it('success', async () => {
      result = await instance.getPending({ publicKey: 100 });
      expect(result).to.deep.equal({
        transactions: [
          { lifetime: 20, max: 3, min: 10, signed: true, transaction: tx1 },
          { lifetime: 200, max: 0, min: 100, signed: true, transaction: tx3 },
        ],
      });
    });

    it('Sender not found', async () => {
      accountsModuleStub.stubs.getAccount.resolves();
      await expect(instance.getPending({ publicKey: 100 })).to.be.rejectedWith(
        'Sender not found'
      );
    });
  });

  describe('sign()', () => {
    it('Throws deprecated', async () => {
      await expect(instance.sign()).to.be.rejectedWith('Method is deprecated');
    });
  });

  describe('addMultisignature()', () => {
    it('Throws deprecated', async () => {
      await expect(instance.addMultisignature()).to.be.rejectedWith(
        'Method is deprecated'
      );
    });
  });
});
