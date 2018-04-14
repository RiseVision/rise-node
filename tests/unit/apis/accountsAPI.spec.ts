import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as rewire from 'rewire';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { AccountsAPI } from '../../../src/apis/accountsAPI';
import { Symbols } from '../../../src/ioc/symbols';
import {
  AccountsModuleStub, DelegatesModuleStub, SystemModuleStub,
} from '../../stubs';
import ZSchemaStub from '../../stubs/helpers/ZSchemaStub';
import { createContainer } from '../../utils/containerCreator';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

const AccountsAPIRewire = rewire('../../../src/apis/accountsAPI');

describe('apis/accountsAPI', () => {

  let sandbox: SinonSandbox;
  let instance: AccountsAPI;
  let container: Container;
  let schema: ZSchemaStub;
  let accountsModule: AccountsModuleStub;
  let delegatesModule: DelegatesModuleStub;
  let systemModule: SystemModuleStub;

  beforeEach(() => {
    sandbox   = sinon.sandbox.create();
    container = createContainer();
    container.bind(Symbols.api.accounts).to(AccountsAPIRewire.AccountsAPI);

    schema          = container.get(Symbols.generic.zschema);
    accountsModule  = container.get(Symbols.modules.accounts);
    delegatesModule = container.get(Symbols.modules.delegates);
    systemModule    = container.get(Symbols.modules.system);
    instance        = container.get(Symbols.api.accounts);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getAccount', () => {

    let isEmptyStub: SinonStub;

    let accData;
    let query;
    let generatedAddress;

    beforeEach(() => {
      generatedAddress = 'generatedAddress';
      query            = {
        address  : 'address',
        publicKey: 'publicKey',
      };
      accData          = {
        address          : 'address',
        balance          : 'balance',
        multisignatures  : [],
        publicKey        : 'publicKey',
        secondPublicKey  : 'secondPublicKey',
        secondSignature  : 'secondSignature',
        u_multisignatures: [],
        u_balance        : 10000,
        u_secondSignature: 'u_secondSignature',
      };

      accountsModule.enqueueResponse('generateAddressByPublicKey', generatedAddress);
      accountsModule.enqueueResponse('getAccount', Promise.resolve(accData));

      isEmptyStub = sandbox.stub();
      isEmptyStub.onCall(0).returns(false)
        .onCall(1).returns(false)
        .onCall(2).returns(true)
        .onCall(3).returns(true);

      AccountsAPIRewire.__set__('isEmpty', isEmptyStub);
    });

    it('should call isEmpty', async () => {
      await instance.getAccount(query);

      expect(isEmptyStub.called).to.be.true;
    });

    describe('Error: Missing required property: address or publicKey', () => {

      it('should throw error if query.address and query.publicKey are empty', async () => {
        isEmptyStub.reset();
        isEmptyStub.returns(true);

        await expect(instance.getAccount(query)).to.be.rejectedWith('Missing required property: address or publicKey');
      });

      it('should not throw error if only query.address is empty', async () => {
        isEmptyStub.onCall(0).returns(true)
          .onCall(1).returns(false);

        await expect(instance.getAccount(query)).to.be.not.rejectedWith('Missing required property: address or publicKey');
      });

      it('should not throw error if only query.publicKey is empty', async () => {
        isEmptyStub.onCall(0).returns(false)
          .onCall(1).returns(true);

        await expect(instance.getAccount(query)).to.be.not.rejectedWith('Missing required property: address or publicKey');
      });
    });

    it('should call this.accountsModule.generateAddressByPublicKey if query.publicKey isn"t empty', async () => {
      await instance.getAccount(query);

      expect(accountsModule.stubs.generateAddressByPublicKey.calledOnce).to.be.true;
      expect(accountsModule.stubs.generateAddressByPublicKey.firstCall.args.length).to.be.equal(1);
      expect(accountsModule.stubs.generateAddressByPublicKey.firstCall.args[0]).to.be.equal(query.publicKey);
    });

    describe('Error: Account publicKey does not match address', () => {

      it('should throw error if query.address and query.publicKey are empty and address !== query.address', async () => {
        isEmptyStub.onCall(2).returns(false);
        isEmptyStub.onCall(3).returns(false);

        await expect(instance.getAccount(query)).to.be.rejectedWith('Account publicKey does not match address');
      });

      it('should not throw error if only query.address is empty', async () => {
        isEmptyStub.onCall(3).returns(false);

        await expect(instance.getAccount(query)).to.be.not.rejectedWith('Account publicKey does not match address');

      });

      it('should not throw error if only query.publicKey is empty', async () => {
        isEmptyStub.onCall(2).returns(false);

        await expect(instance.getAccount(query)).to.be.not.rejectedWith('Account publicKey does not match address');

      });

      it('should not throw error if only address === query.address and check of setting address in query.address if query.publicKey is empty', async () => {
        isEmptyStub.onCall(1).returns(true);
        isEmptyStub.onCall(2).returns(false);
        isEmptyStub.onCall(3).returns(false);

        await expect(instance.getAccount(query)).to.be.not.rejectedWith('Account publicKey does not match address');
      });
    });

    it('should call accountsModule.getAccount', async () => {
      await instance.getAccount(query);

      expect(accountsModule.stubs.getAccount.calledOnce).to.be.true;
      expect(accountsModule.stubs.getAccount.firstCall.args.length).to.be.equal(1);
      expect(accountsModule.stubs.getAccount.firstCall.args[0]).to.be.deep.equal(query);
    });

    it('should throw error if accountsModule.getAccount returns falsy ', async () => {
      accountsModule.reset();
      accountsModule.enqueueResponse('generateAddressByPublicKey', generatedAddress);
      accountsModule.enqueueResponse('getAccount', null);

      await expect(instance.getAccount(query)).to.be.rejectedWith('Account not found');
    });

    it('success', async () => {
      const res = await instance.getAccount(query);

      expect(res).to.be.deep.equal({account: {
          address             : accData.address,
          balance             : accData.balance,
          multisignatures     : accData.multisignatures,
          publicKey           : accData.publicKey,
          secondPublicKey     : accData.secondPublicKey,
          secondSignature     : accData.secondSignature,
          u_multisignatures   : accData.u_multisignatures,
          unconfirmedBalance  : accData.u_balance,
          unconfirmedSignature: accData.u_secondSignature,
        }});
    });

  });

  describe('getBalance', () => {

    let params;
    let account;

    beforeEach(() => {
      params  = { address: 'address' };
      account = {
        balance  : '1',
        u_balance: '1',
      };
      accountsModule.enqueueResponse('getAccount', Promise.resolve(account));
    });

    it('should call accountsModule.getAccount', async () => {
      await instance.getBalance(params);

      expect(accountsModule.stubs.getAccount.calledOnce).to.be.true;
      expect(accountsModule.stubs.getAccount.firstCall.args.length).to.be.equal(1);
      expect(accountsModule.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ address: 'address' });
    });

    it('success', async () => {
      const ret = await instance.getBalance(params);

      expect(ret).to.be.deep.equal({
        balance           : '1',
        unconfirmedBalance: '1',
      });
    });

    it('should throw error if account not found', async () => {
      accountsModule.reset();
      accountsModule.enqueueResponse('getAccount', Promise.resolve());

      const ret = await instance.getBalance(params);

      expect(ret).to.be.deep.equal({
        balance           : '0',
        unconfirmedBalance: '0',
      });
    });

  });

  describe('getPublickey', () => {

    let params;
    let account;

    beforeEach(() => {
      params  = { address: 'address' };
      account = {
        publicKey: '1',
      };
      accountsModule.enqueueResponse('getAccount', Promise.resolve(account));
    });

    it('should call accountsModule.getAccount', async () => {
      await instance.getPublickey(params);

      expect(accountsModule.stubs.getAccount.calledOnce).to.be.true;
      expect(accountsModule.stubs.getAccount.firstCall.args.length).to.be.equal(1);
      expect(accountsModule.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ address: 'address' });
    });

    it('success', async () => {
      const ret = await instance.getPublickey(params);

      expect(ret).to.be.deep.equal({
        publicKey: '1',
      });
    });

    it('should throw error if account not found', async () => {
      accountsModule.reset();
      accountsModule.enqueueResponse('getAccount', Promise.resolve());

      await expect(instance.getPublickey(params)).to.be.rejectedWith('Account not found');
    });

  });

  describe('getDelegates', () => {

    let params;
    let account;

    beforeEach(() => {
      params  = { address: 'address' };
      account = { publicKey: '1' };

      accountsModule.enqueueResponse('getAccount', Promise.resolve(account));
    });

    it('should call accountsModule.getAccount', async () => {
      await instance.getDelegates(params);

      expect(accountsModule.stubs.getAccount.calledOnce).to.be.true;
      expect(accountsModule.stubs.getAccount.firstCall.args.length).to.be.equal(1);
      expect(accountsModule.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ address: 'address' });
    });

    it('should throw error if account not found', async () => {
      accountsModule.reset();
      accountsModule.enqueueResponse('getAccount', Promise.resolve());

      await expect(instance.getDelegates(params)).to.be.rejectedWith('Account not found');
    });

    describe('account.delegates is not null', () => {

      let delegatesFromQuery;
      let del1;
      let del2;

      beforeEach(() => {
        del1               = { publicKey: '1' };
        del2               = { publicKey: '3' };
        account.delegates  = ['1', '2'];
        delegatesFromQuery = [del1, del2];
        accountsModule.reset();
        accountsModule.enqueueResponse('getAccount', Promise.resolve(account));
        delegatesModule.enqueueResponse('getDelegates', Promise.resolve({ delegates: delegatesFromQuery }));
      });

      it('should call delegatesModule.getDelegates', async () => {
        await instance.getDelegates(params);

        expect(delegatesModule.stubs.getDelegates.calledOnce).to.be.true;
        expect(delegatesModule.stubs.getDelegates.firstCall.args.length).to.be.equal(1);
        expect(delegatesModule.stubs.getDelegates.firstCall.args[0]).to.be.deep.equal({ orderBy: 'rank:desc' });
      });

      it('should return object with same delegates from account"s delegates', async () => {
        const ret = await instance.getDelegates(params);

        expect(ret).to.be.deep.equal({
          delegates: [
            {
              publicKey: '1',
            },
          ],
        });
      });

    });

    it('should return object with publicKey if account.delegates is null', async () => {
      const ret = await instance.getDelegates(params);

      expect(ret).to.be.deep.equal({ publicKey: '1' });
    });

  });

  describe('getDelegatesFee', () => {

    let params;
    let fee;

    beforeEach(() => {
      fee    = {
        fees: {
          delegate: 1,
        },
      };
      params = { height: 1 };
      systemModule.enqueueResponse('getFees', fee);
    });

    it('should call systemModule.getFees', async () => {
      await instance.getDelegatesFee(params);

      expect(systemModule.stubs.getFees.calledOnce).to.be.true;
      expect(systemModule.stubs.getFees.firstCall.args.length).to.be.equal(1);
      expect(systemModule.stubs.getFees.firstCall.args[0]).to.be.equal(params.height);
    });

    it('success', async () => {
      const ret = await instance.getDelegatesFee(params);

      expect(ret).to.be.deep.equal({ fee: fee.fees.delegate });
    });

  });

  describe('open', () => {

    it('should throw error', async () => {
      await expect(instance.open({ secret: 'sds' })).to.be.rejectedWith('Method is deprecated');
    });

  });
  describe('addDelegate', () => {

    it('should throw error', async () => {
      await expect(instance.addDelegate()).to.be.rejectedWith('Method is deprecated');
    });

  });
  describe('generatePublicKey', () => {

    it('should throw error', async () => {
      await expect(instance.generatePublicKey()).to.be.rejectedWith('Method is deprecated');
    });

  });

});
