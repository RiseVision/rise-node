import { IAccountsModel, IAccountsModule } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { Address } from '@risevision/core-types';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { As } from 'type-tagger';
import { AccountLogic, AccountsSymbols } from '../../../src';

chai.use(chaiAsPromised);
// tslint:disable no-unused-expression no-big-function object-literal-sort-keys max-line-length no-identical-functions max-classes-per-file
const validPubKey = Buffer.from(new Array(32).fill('aa').join(''), 'hex');
const validAddress = '2355684370867218400R';
describe('modules/accounts', () => {
  let sandbox: SinonSandbox;
  let accountModule: IAccountsModule;
  let container: Container;
  let accountLogic: AccountLogic;
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-accounts',
      'core-helpers',
      'core-crypto',
      'core-transactions',
    ]);
    accountModule = container.get<any>(AccountsSymbols.module);
    accountLogic = container.get<any>(AccountsSymbols.logic);
  });

  afterEach(() => {
    sandbox.restore();
  });

  // describe('cleanup', () => {
  //   it('should return resolved promise', async () => {
  //     await expect(accountModule.cleanup()).to.be.fulfilled;
  //   });
  // });

  describe('.getAccount', () => {
    let getStub: SinonStub;
    beforeEach(() => {
      getStub = sandbox
        .stub(accountLogic, 'get')
        .callsFake((filter) => Promise.resolve(filter as any));
    });
    it('should call accountLogic.get', async () => {
      await accountModule.getAccount({ address: '1L' });
      expect(getStub.called).is.true;
    });
  });
  //
  describe('.getAccounts', () => {
    let aLogicGetAllStub: SinonStub;
    beforeEach(() => {
      aLogicGetAllStub = sandbox
        .stub(accountLogic, 'getAll')
        .callsFake((query) => Promise.resolve(query as any));
    });
    it('should directly pass params to accountLogic.getAll', async () => {
      await accountModule.getAccounts({ address: '1R' });
      expect(aLogicGetAllStub.called).true;
      expect(aLogicGetAllStub.firstCall.args[0]).deep.eq({ address: '1R' });
    });
    it('should return what accountLogic.getAll returns', async () => {
      const theRes = { cat: 'meows' };
      aLogicGetAllStub.resolves(theRes);
      expect(await accountModule.getAccounts({ address: '1R' })).deep.eq(
        theRes
      );
    });
  });

  describe('checkTXsAccountsMap', () => {
    let accountsModel: typeof IAccountsModel;
    let unfoldSenderStub: SinonStub;
    beforeEach(() => {
      accountsModel = container.getNamed(
        ModelSymbols.model,
        AccountsSymbols.model
      );
      unfoldSenderStub = sandbox
        .stub(accountModule, 'unfoldSenders')
        .resolves([]);
    });
    it('should throw if account is not found in db', async () => {
      unfoldSenderStub.returns(['add11']);
      await expect(accountModule.checkTXsAccountsMap([], {})).rejectedWith(
        'Account add11 not found in db'
      );
    });
    it('should throw if account has diff publicKey in db', async () => {
      unfoldSenderStub.returns(['add11']);
      await expect(
        accountModule.checkTXsAccountsMap([], {
          add11: { address: 'add12' },
        } as any)
      ).rejectedWith('Stealing attempt type.1 for add11');
    });
  });

  describe('txAccounts', () => {
    let accountsModel: typeof IAccountsModel;
    let findAllStub: SinonStub;
    beforeEach(() => {
      accountsModel = container.getNamed(
        ModelSymbols.model,
        AccountsSymbols.model
      );
      findAllStub = sandbox.stub(accountsModel, 'findAll').resolves([]);
    });
    it('shouldnt complain about empty txs array', async () => {
      const res = await accountModule.txAccounts([]);
      expect(res).to.be.deep.eq({});

      // should not even call findAll
      expect(findAllStub.calledOnce).is.false;
    });
    it('should return empty object if account not in db', async () => {
      const r = await accountModule.txAccounts([
        { senderId: 'add11', senderPubData: Buffer.from('11', 'hex') } as any,
      ]);
      expect(r).deep.eq({});
    });
  });

  //
  describe('.mergeAccountAndGetOPs', () => {
    let mergeStub: SinonStub;
    beforeEach(() => {
      mergeStub = sandbox
        .stub(container.get<any>(AccountsSymbols.logic), 'merge')
        .returns(['one', 'two']);
    });
    it('should throw if no publicKey and address is provided', async () => {
      expect(() => accountModule.mergeAccountAndGetOPs({} as any)).to.be.throw(
        'Missing address and public key'
      );
    });
    it('should derive address from publicKey if not provided', () => {
      const res = accountModule.mergeAccountAndGetOPs({
        address: 'meow' as Address,
        balance: 10n,
      });

      expect(mergeStub.called).true;
      expect(mergeStub.calledWith('meow', { balance: 10n })).true;
      expect(res).deep.eq(['one', 'two']);
    });
  });
  //
  describe('.generateAddressByPubData', () => {
    it('should resolve pubkey and addresses correctly', () => {
      for (let i = 0; i < 100; i++) {
        const w = RiseV2.deriveKeypair(`a${i}`);
        expect(accountModule.generateAddressByPubData(w.publicKey)).deep.eq(
          RiseV2.calcAddress(w.publicKey, 'main', 'v0')
        );
        expect(
          accountModule.generateAddressByPubData(Buffer.concat([
            Buffer.from([1]),
            w.publicKey,
          ]) as Buffer & As<'publicKey'>)
        ).deep.eq(RiseV2.calcAddress(w.publicKey, 'main', 'v1'));
      }
    });
  });
});
