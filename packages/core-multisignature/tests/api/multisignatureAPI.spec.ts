import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as filterObject from 'filter-object';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStatic, SinonStub } from 'sinon';
import { IAccountsModule, ITransactionLogic, ITransactionsModule } from '@risevision/core-interfaces';
import { Accounts2MultisignaturesModel } from '../../src/models';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { Symbols } from '@risevision/core-interfaces';
import { MultisigSymbols } from '../../src/helpers';
import { AccountsModel } from '@risevision/core-accounts';
import { ModelSymbols } from '@risevision/core-models';
import { MultiSignaturesApi } from '../../src/multiSignaturesApi';
import { APISymbols } from '@risevision/core-apis';
import { LiskWallet } from 'dpos-offline';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('apis/multisignatureAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: MultiSignaturesApi;
  let result: any;
  let accountsModule: IAccountsModule;
  let account1: any;
  let account2: any;
  let account3: any;
  let account4: any;
  let account5: any;
  let account6: any;
  let tx1: any;
  let tx2: any;
  let tx3: any;
  let tx4: any;
  let accounts2multisignaturesModel: typeof Accounts2MultisignaturesModel;
  let transactionsModule: ITransactionsModule;
  let transactionLogic: ITransactionLogic;

  let getAccountsStub: SinonStub;
  let genAddressStub: SinonStub;
  let verifySignatureStub: SinonStub;
  let getAccountStub: SinonStub;
  beforeEach(async () => {
    container = await createContainer(['core-multisignature', 'core', 'core-helpers']);

    sandbox                       = sinon.createSandbox();
    instance                      = container.getNamed(APISymbols.api, MultisigSymbols.api);
    accounts2multisignaturesModel = container.getNamed(ModelSymbols.model, MultisigSymbols.models.accounts2Multi);
    accountsModule                = container.get(Symbols.modules.accounts);
    account1                      = new AccountsModel({
      address        : 'aaa',
      balance        : 100,
      id             : 1,
      multilifetime  : 101,
      multimin       : 102,
      multisignatures: [new LiskWallet('10').publicKey, new LiskWallet('20').publicKey, new LiskWallet('30').publicKey,],
    } as any);
    account2                      = new AccountsModel({
      address        : 'bbb',
      balance        : 200,
      id             : 2,
      multilifetime  : 201,
      multimin       : 202,
      multisignatures: [new LiskWallet('40').publicKey, new LiskWallet('50').publicKey, new LiskWallet('60').publicKey,],
    } as any);
    account3                      = new AccountsModel({ id: 3, address: 'ccc', publicKey: 'c3c3c3', balance: 300 } as any);
    account4                      = new AccountsModel({ id: 4, address: 'ddd', publicKey: 'c4c4c4', balance: 400 } as any);
    account5                      = new AccountsModel({
      u_multilifetime  : 20,
      u_multimin       : 10,
      u_multisignatures: [new LiskWallet('a').publicKey, new LiskWallet('b').publicKey, new LiskWallet('c').publicKey,],
    } as any);
    account6                      = new AccountsModel({
      multilifetime    : 200,
      multimin         : 100,
      u_multisignatures: undefined,
    } as any);

    getAccountsStub = sandbox.stub(accountsModule, 'getAccounts');
    genAddressStub  = sandbox.stub(accountsModule, 'generateAddressByPublicKey').returns(1000);
    getAccountsStub.onFirstCall().resolves([account1, account2]);
    getAccountsStub.onSecondCall().resolves([account3]);
    getAccountsStub.onThirdCall().resolves([account4]);
    getAccountStub = sandbox.stub(accountsModule, 'getAccount');

    getAccountStub.onFirstCall().resolves(account5);
    getAccountStub.onSecondCall().resolves(account6);

    transactionsModule = container.get(Symbols.modules.transactions);
    tx1                    = { id: 1, type: 4, senderPublicKey: Buffer.from(new LiskWallet('meow').publicKey, 'hex') , signatures: ['aaa'] };
    tx2                    = { id: 2, type: 4, senderPublicKey: Buffer.from('ab', 'hex') };
    tx3                    = { id: 3, type: 4, senderPublicKey: Buffer.from(new LiskWallet('meow').publicKey, 'hex')  };
    tx4                    = { id: 3, type: 123, senderPublicKey: Buffer.from(new LiskWallet('meow').publicKey, 'hex')  };
    sandbox.stub(transactionsModule, 'getPendingTransactionList').returns([
      tx1,
      tx2,
      tx3,
      tx4,
    ]);

    transactionLogic = container.get(Symbols.logic.transaction);
    verifySignatureStub = sandbox.stub(transactionLogic, 'verifySignature').returns(true);

  });
  afterEach(() => sandbox.reset());

  describe('getAccounts()', () => {
    it('should return an array of accounts', async () => {
      sandbox.stub(accounts2multisignaturesModel, 'findAll').resolves([{ accountId: '1' }, { accountId: '2' }, { accountId: '3' }]);
      result = await instance.getAccounts({ publicKey: new LiskWallet('meow').publicKey });

      const accounts = [];
      accounts.push(filterObject({ ...account1.toPOJO(), ...{ multisigaccounts: [filterObject(account3.toPOJO(), '!secondPublicKey')] } }, ['!publicKey', '!secondPublicKey']));
      accounts.push(filterObject({ ...account2.toPOJO(), ...{ multisigaccounts: [filterObject(account4.toPOJO(), '!secondPublicKey')] } }, ['!publicKey', '!secondPublicKey']));
      expect(result).to.deep.equal({ accounts });

      expect(getAccountsStub.callCount).to.equal(3);
      expect(getAccountsStub.args[0][0]).to.deep.equal({
        address: { $in: ['1', '2', '3'] },
        sort   : 'balance',
      });
      expect(getAccountsStub.args[1][0]).to.deep.equal({
        address: { $in: [1000, 1000, 1000] },
      });
      expect(getAccountsStub.args[1][0]).to.deep.equal({
        address: { $in: [1000, 1000, 1000] },
      });
    });
  });

  describe('getPending()', () => {
    it('should return an object with pending transactions', async () => {
      result = await instance.getPending({ publicKey: new LiskWallet('meow').publicKey });
      expect(result).to.deep.equal({
        transactions: [
          { lifetime: 20, max: 3, min: 10, signed: true, transaction: { ...tx1, senderPublicKey: tx1.senderPublicKey.toString('hex') } },
          { lifetime: 200, max: 0, min: 100, signed: true, transaction: { ...tx3, senderPublicKey: tx3.senderPublicKey.toString('hex') } },
        ],
      });
    });

    it('Sender not found', async () => {
      getAccountStub.resetBehavior();
      getAccountStub.resolves()
      await expect(instance.getPending({ publicKey: new LiskWallet('meow').publicKey })).to.be.rejectedWith(
        'Sender not found'
      );
    });
  });

});
