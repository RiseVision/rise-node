import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import {SinonSandbox, SinonStub} from 'sinon';
import { IAccountsModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { AccountsModule } from '../../../src/modules';
import AccountLogicStub from '../../stubs/logic/AccountLogicStub';
import { createContainer } from '../../utils/containerCreator';
import DbStub from '../../stubs/helpers/DbStub';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression

describe('modules/accounts', () => {
  let sandbox: SinonSandbox;
  let accountLogicStub: AccountLogicStub;
  let accountModule: IAccountsModule;
  let container: Container;

  beforeEach(() => {
    sandbox          = sinon.sandbox.create();
    container        = createContainer();
    accountLogicStub = container.get(Symbols.logic.account);
    container.rebind<IAccountsModule>(Symbols.modules.accounts).to(AccountsModule).inSingletonScope();
    accountModule    = container.get<any>(Symbols.modules.accounts);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('cleanup', () => {
    it('should return resolved promise', async () => {
      await expect(accountModule.cleanup()).to.be.fulfilled;
    });
  });

  describe('.getAccount', () => {
    it('should call accountLogic.get', async () => {
      accountLogicStub.enqueueResponse('get', 'diocan');
      await accountModule.getAccount({address: '1L'});
      expect(accountLogicStub.stubs.get.called).is.true;
    });
    it('should derive address from publicKey if not provided', async () => {
      accountLogicStub.enqueueResponse('generateAddressByPublicKey', '123L');
      accountLogicStub.enqueueResponse('get', 'result');
      await accountModule.getAccount({publicKey: '1235'});

      expect(accountLogicStub.stubs.generateAddressByPublicKey.called).is.true;
      expect(accountLogicStub.stubs.generateAddressByPublicKey.firstCall.args[0]).is.eq('1235');
      expect(accountLogicStub.stubs.get.called).is.true;
      expect(accountLogicStub.stubs.get.firstCall.args[0]).to.be.deep.eq({
        address: '123L',
      });
    });
    it('shoul return what accountLogic.get returns', async () => {
      accountLogicStub.enqueueResponse('get', 'result');
      expect(await accountModule.getAccount({address: '123L'}))
        .to.be.eq('result');
    });
  });

  describe('.getAccounts', () => {
    it('should directly pass params to accountLogic.getAll', async () => {
      accountLogicStub.enqueueResponse('getAll', null);
      await accountModule.getAccounts({address: '1L'}, ['address']);

      expect(accountLogicStub.stubs.getAll.called).is.true;
      expect(accountLogicStub.stubs.getAll.firstCall.args.length).is.eq(2);
      expect(accountLogicStub.stubs.getAll.firstCall.args[0])
        .to.be.deep.eq({address: '1L'});
      expect(accountLogicStub.stubs.getAll.firstCall.args[1])
        .to.be.deep.eq(['address']);
    });
    it('should return what accountLogic.getAll returns', async () => {
      const theRes = {the: 'result'};
      accountLogicStub.enqueueResponse('getAll', theRes);
      const res = await accountModule.getAccounts({address: '1L'}, ['address']);

      expect(res).to.be.deep.eq(theRes);
    });
  });

  describe('.setAccountAndGet', () => {
    it('should throw if no publicKey and address is provided', async () => {
      await expect(accountModule.setAccountAndGet({} as any))
        .to.be.rejectedWith('Missing address and public key');
    });
    it('should derive address from publicKey if not provided', async () => {
      accountLogicStub.enqueueResponse('generateAddressByPublicKey', '1L');
      accountLogicStub.enqueueResponse('set', null);
      accountLogicStub.enqueueResponse('get', null);
      await accountModule.setAccountAndGet({publicKey: 'public'});
      expect(accountLogicStub.stubs.generateAddressByPublicKey.called).is.true;
      expect(accountLogicStub.stubs.generateAddressByPublicKey.firstCall.args[0])
        .to.be.deep.eq('public');
    });
    it('should call accountLogic.set with address and data', async () => {
      accountLogicStub.enqueueResponse('set', null);
      accountLogicStub.enqueueResponse('get', null);
      await accountModule.setAccountAndGet({address: '1L'});

      expect(accountLogicStub.stubs.set.calledOnce).is.true;
      expect(accountLogicStub.stubs.get.calledOnce).is.true;

      expect(accountLogicStub.stubs.set.firstCall.args[0]).to.be.eq('1L');
      expect(accountLogicStub.stubs.set.firstCall.args[1]).to.be.deep.eq({});

      expect(accountLogicStub.stubs.get.firstCall.args[0]).to.be.deep.eq({address: '1L'});
    });
    it('should accountLogi.get with address and return its value', async () => {
      accountLogicStub.enqueueResponse('set', null);
      accountLogicStub.enqueueResponse('get', 'antani');
      const toRet = await accountModule.setAccountAndGet({address: '1L'});

      expect(toRet).to.be.eq('antani');
    });
  });

  describe('.mergeAccountAndGetOPs', () => {
    it('should throw if no publicKey and address is provided', async () => {
      expect(() => accountModule.mergeAccountAndGetOPs({} as any))
        .to.be.throw('Missing address and public key');
    });
    it('should derive address from publicKey if not provided', () => {
      accountLogicStub.enqueueResponse('generateAddressByPublicKey', '1L');
      accountLogicStub.enqueueResponse('merge', null);
      accountModule.mergeAccountAndGetOPs({publicKey: 'public'});
      expect(accountLogicStub.stubs.generateAddressByPublicKey.called).is.true;
      expect(accountLogicStub.stubs.generateAddressByPublicKey.firstCall.args[0])
        .to.be.deep.eq('public');
    });
    it('should call accountLogic.merge with address and return its value', async () => {
      accountLogicStub.enqueueResponse('merge', 'mergeResult');
      const toRet = accountModule.mergeAccountAndGetOPs({address: '1L'});
      expect(toRet).to.be.eq('mergeResult');
    });
  });

  describe('.mergeAccountAndGet', () => {
    let dbHelperStub: DbStub;
    let getAccountStub: SinonStub;
    beforeEach(() => {
      dbHelperStub = container.get(Symbols.helpers.db);
      getAccountStub = sandbox.stub(accountModule, 'getAccount').resolves('hey');
    });
    it('should throw if no publicKey and address is provided', async () => {
      await expect(accountModule.mergeAccountAndGet({} as any))
        .to.be.rejectedWith('Missing address and public key');
    });
    it('should derive address from publicKey if not provided', async () => {
      dbHelperStub.enqueueResponse('performOps', Promise.resolve());
      accountLogicStub.enqueueResponse('generateAddressByPublicKey', '1L');
      accountLogicStub.enqueueResponse('merge', null);


      await accountModule.mergeAccountAndGet({publicKey: 'public'});
      expect(accountLogicStub.stubs.generateAddressByPublicKey.called).is.true;
      expect(accountLogicStub.stubs.generateAddressByPublicKey.firstCall.args[0])
        .to.be.deep.eq('public');
    });
    it('should return whatever getAccount does after calling performOps', async () => {
      dbHelperStub.enqueueResponse('performOps', Promise.resolve());
      accountLogicStub.enqueueResponse('generateAddressByPublicKey', '1L');
      accountLogicStub.enqueueResponse('merge', null);

      const res = await accountModule.mergeAccountAndGet({publicKey: 'public'});
      expect(res).eq('hey'); // set in beforeEach
      expect(dbHelperStub.stubs.performOps.firstCall.calledBefore(
        getAccountStub.firstCall
      ));
    });
  });

  describe('.generateAddressByPublicKey', () => {
    it('should call accountLogic.generateAddressByPublicKey', () => {
      accountLogicStub.enqueueResponse('generateAddressByPublicKey', 'addressResult');
      const res = accountModule.generateAddressByPublicKey('pubKey');

      expect(res).to.be.eq('addressResult');
      expect(accountLogicStub.stubs.generateAddressByPublicKey.called).is.true;
      expect(accountLogicStub.stubs.generateAddressByPublicKey.firstCall.args[0]).to.be.eq('pubKey');
    });
  });

});
