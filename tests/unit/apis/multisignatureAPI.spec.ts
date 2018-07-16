import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as filterObject from 'filter-object';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { MultisignatureAPI } from '../../../src/apis';
import { Symbols } from '../../../src/ioc/symbols';
import { AccountsModuleStub, TransactionLogicStub, TransactionsModuleStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { Accounts2MultisignaturesModel, AccountsModel } from '../../../src/models';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('apis/multisignatureAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: any;
  let result: any;
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
  let accounts2multisignaturesModel: typeof Accounts2MultisignaturesModel;

  beforeEach(() => {
    container = createContainer();
    sandbox   = sinon.createSandbox();
    container
      .bind(Symbols.api.multisignatures)
      .to(MultisignatureAPI);

    accounts2multisignaturesModel = container.get(Symbols.models.accounts2Multisignatures);

    account1 = new AccountsModel({
      address        : 'aaa',
      balance        : 100,
      id             : 1,
      multilifetime  : 101,
      multimin       : 102,
      multisignatures: [10, 20, 30],
    });
    account2 = new AccountsModel({
      address        : 'bbb',
      balance        : 200,
      id             : 2,
      multilifetime  : 201,
      multimin       : 202,
      multisignatures: [40, 50, 60],
    });
    account3 = new AccountsModel({ id: 3, address: 'ccc', publicKey: 'c3c3c3', balance: 300 });
    account4 = new AccountsModel({ id: 4, address: 'ddd', publicKey: 'c4c4c4', balance: 400 });
    account5 = new AccountsModel({
      u_multilifetime  : 20,
      u_multimin       : 10,
      u_multisignatures: ['a', 'b', 'c'],
    });
    account6 = new AccountsModel({
      multilifetime    : 200,
      multimin         : 100,
      u_multisignatures: undefined,
    });

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
    tx1                    = { id: 1, senderPublicKey: Buffer.from('aa', 'hex'), signatures: ['aaa'] };
    tx2                    = { id: 2, senderPublicKey: Buffer.from('ab', 'hex') };
    tx3                    = { id: 3, senderPublicKey: Buffer.from('aa', 'hex') };
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
    it('should return an array of accounts', async () => {
      sandbox.stub(accounts2multisignaturesModel, 'findAll').resolves([{ accountId: '1' }, { accountId: '2' }, { accountId: '3' }]);
      result = await instance.getAccounts({ publicKey: '123' });

      const accounts = [];
      accounts.push(filterObject({ ...account1.toPOJO(), ...{ multisigaccounts: [filterObject(account3.toPOJO(), '!secondPublicKey')] } }, ['!publicKey', '!secondPublicKey']));
      accounts.push(filterObject({ ...account2.toPOJO(), ...{ multisigaccounts: [filterObject(account4.toPOJO(), '!secondPublicKey')] } }, ['!publicKey', '!secondPublicKey']));
      expect(result).to.deep.equal({ accounts });

      expect(accountsModuleStub.stubs.getAccounts.callCount).to.equal(3);
      expect(accountsModuleStub.stubs.getAccounts.args[0][0]).to.deep.equal({
        address: { $in: ['1', '2', '3'] },
        sort   : 'balance',
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
    it('should return an object with pending transactions', async () => {
      result = await instance.getPending({ publicKey: 'aa' });
      expect(result).to.deep.equal({
        transactions: [
          { lifetime: 20, max: 3, min: 10, signed: true, transaction: {... tx1, senderPublicKey: tx1.senderPublicKey.toString('hex') }},
          { lifetime: 200, max: 0, min: 100, signed: true, transaction: {... tx3, senderPublicKey: tx3.senderPublicKey.toString('hex') } },
        ],
      });
    });

    it('Sender not found', async () => {
      accountsModuleStub.stubs.getAccount.resolves();
      await expect(instance.getPending({ publicKey: 'aa' })).to.be.rejectedWith(
        'Sender not found'
      );
    });
  });

  describe('sign()', () => {
    it('should throw deprecated', async () => {
      await expect(instance.sign()).to.be.rejectedWith('Method is deprecated');
    });
  });

  describe('addMultisignature()', () => {
    it('should throw deprecated', async () => {
      await expect(instance.addMultisignature()).to.be.rejectedWith(
        'Method is deprecated'
      );
    });
  });
});
