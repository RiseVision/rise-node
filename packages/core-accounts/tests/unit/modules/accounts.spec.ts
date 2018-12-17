import { IAccountsModel, IAccountsModule } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
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
    it('should derive address from publicKey if not provided', async () => {
      const res = await accountModule.getAccount({ publicKey: validPubKey });
      expect(res).deep.eq({ address: validAddress });
      expect(getStub.called).true;
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
    let findAllStub: SinonStub;
    let assignPublicKeyToAccount: SinonStub;
    beforeEach(() => {
      accountsModel = container.getNamed(
        ModelSymbols.model,
        AccountsSymbols.model
      );
      findAllStub = sandbox.stub(accountsModel, 'findAll').resolves([]);
      assignPublicKeyToAccount = sandbox
        .stub(accountModule, 'assignPublicKeyToAccount')
        .callsFake(({ publicKey }) =>
          Promise.resolve({
            publicKey,
            address: `add${publicKey.toString('hex')}`,
          } as any)
        );
    });
    it('should throw if account is not found in db', async () => {
      await expect(
        accountModule.checkTXsAccountsMap(
          [
            {
              senderId: 'add11',
              senderPublicKey: Buffer.from('11', 'hex'),
            } as any,
          ],
          {}
        )
      ).rejectedWith('Account add11 not found in db');
    });
    it('should throw if account has diff publicKey in db', async () => {
      await expect(
        accountModule.checkTXsAccountsMap(
          [
            {
              senderId: 'add11',
              senderPublicKey: Buffer.from('11', 'hex'),
            } as any,
          ],
          {
            add11: { address: 'add11', publicKey: Buffer.from('22', 'hex') },
          } as any
        )
      ).rejectedWith('Stealing attempt type.2 for add11');
    });
    it('should setAccountAndGet if nopublickey set in db and throw if address does not match', async () => {
      await expect(
        accountModule.checkTXsAccountsMap(
          [
            {
              senderId: 'add11',
              senderPublicKey: Buffer.from('22', 'hex'),
            } as any,
          ],
          { add11: { address: 'add11' } } as any
        )
      ).rejectedWith('Stealing attempt type.1 for add11');
      expect(assignPublicKeyToAccount.called).is.true;
      expect(assignPublicKeyToAccount.firstCall.args[0]).is.deep.eq({
        publicKey: Buffer.from('22', 'hex'),
      });
    });
  });

  describe('txAccounts', () => {
    let accountsModel: typeof IAccountsModel;
    let findAllStub: SinonStub;
    let assignPublicKeyToAccount: SinonStub;
    beforeEach(() => {
      accountsModel = container.getNamed(
        ModelSymbols.model,
        AccountsSymbols.model
      );
      findAllStub = sandbox.stub(accountsModel, 'findAll').resolves([]);
      assignPublicKeyToAccount = sandbox
        .stub(accountModule, 'assignPublicKeyToAccount')
        .callsFake(({ publicKey }) =>
          Promise.resolve({
            publicKey,
            address: `add${publicKey.toString('hex')}`,
          } as any)
        );
    });
    it('shouldnt complain about empty txs array', async () => {
      const res = await accountModule.txAccounts([]);
      expect(res).to.be.deep.eq({});

      // should not even call findAll
      expect(findAllStub.calledOnce).is.false;
    });
    it('should return empty object if account not in db', async () => {
      const r = await accountModule.txAccounts([
        { senderId: 'add11', senderPublicKey: Buffer.from('11', 'hex') } as any,
      ]);
      expect(r).deep.eq({});
    });
  });

  describe('.assignPublicKeyToAccount', () => {
    let setStub: SinonStub;
    let getStub: SinonStub;
    beforeEach(() => {
      setStub = sandbox.stub(accountLogic, 'set').resolves();
      getStub = sandbox.stub(accountLogic, 'get').resolves();
    });
    it('should throw if no publicKey and address is provided', async () => {
      await expect(
        accountModule.assignPublicKeyToAccount({
          address: '1a',
          publicKey: null,
        })
      ).to.be.rejectedWith('Missing publicKey for 1a');
    });
    it('should check address against publicKey', async () => {
      await expect(
        accountModule.assignPublicKeyToAccount({
          address: '1a',
          publicKey: validPubKey,
        })
      ).rejectedWith(
        'Attempting to assign publicKey to non correct address 2355684370867218400R != 1a'
      );
    });
    it('should allow empty address', async () => {
      await accountModule.assignPublicKeyToAccount({ publicKey: validPubKey });
      expect(setStub.calledWith(validAddress, { publicKey: validPubKey })).true;
    });
    it('should accountLogi.get with address and return its value', async () => {
      getStub.resolves('antani');
      const toRet = await accountModule.assignPublicKeyToAccount({
        address: validAddress,
        publicKey: validPubKey,
      });
      expect(getStub.calledWith({ address: validAddress })).true;
      expect(setStub.calledWith(validAddress, { publicKey: validPubKey })).true;
      expect(toRet).to.be.eq('antani');
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
        address: 'meow',
        publicKey: validPubKey,
        balance: 10n,
      });
      expect(mergeStub.called).true;
      expect(
        mergeStub.calledWith(validAddress, {
          publicKey: validPubKey,
          balance: 10n,
        })
      ).true;
      expect(res).deep.eq(['one', 'two']);
    });
  });
  //
  describe('.generateAddressByPublicKey', () => {
    it('should resolve pubkey and addresses correctly', () => {
      for (let i = 0; i < 100; i++) {
        const w = new LiskWallet(`a${i}`, 'R');
        expect(
          accountModule.generateAddressByPublicKey(
            Buffer.from(w.publicKey, 'hex')
          )
        ).deep.eq(w.address);
      }
    });
  });
});
