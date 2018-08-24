import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { AccountsAPI, DelegatesAPI } from '../../src/apis';
import { IAccountsModule, ISystemModule } from '../../../core-interfaces/src/modules';
import { DelegatesModule } from '../../src/modules';
import { dPoSSymbols } from '../../src/helpers';
import { AccountsModelForDPOS } from '../../src/models';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { Symbols } from '../../../core-interfaces/src';
import { ModelSymbols } from '../../../core-models/src/helpers';
import { APISymbols } from '../../../core-apis/src/helpers';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

describe('apis/accountsAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: AccountsAPI;
  let accounts: IAccountsModule;
  let delegatesModule: DelegatesModule;
  let accountsModel: typeof AccountsModelForDPOS;
  let system: ISystemModule;
  beforeEach(async () => {
    sandbox         = sinon.createSandbox();
    container       = await createContainer(['core-consensus-dpos', 'core-helpers', 'core']);
    accountsModel   = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    accounts        = container.get(Symbols.modules.accounts);
    delegatesModule = container.get(dPoSSymbols.modules.delegates);
    system          = container.get(Symbols.modules.system);
    instance        = container.getNamed(APISymbols.api, dPoSSymbols.accountsAPI);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getDelegates', () => {

    let params;
    let account;
    let getAccountStub: SinonStub;
    beforeEach(() => {
      params  = { address: '1R' };
      account = { publicKey: '1' };
      getAccountStub = sandbox.stub(accounts, 'getAccount').resolves(account);
    });

    it('should call accountsModule.getAccount', async () => {
      await instance.getDelegates(params);

      expect(getAccountStub.calledOnce).to.be.true;
      expect(getAccountStub.firstCall.args.length).to.be.equal(1);
      expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({ address: '1R' });
    });

    it('should throw error if account not found', async () => {
      getAccountStub.resolves();
      await expect(instance.getDelegates(params)).to.be.rejectedWith('Account not found');
    });

    describe('account.delegates is not null', () => {

      let delegatesFromQuery;
      let del1;
      let del2;
      let getDelegatesStub: SinonStub;
      beforeEach(() => {
        del1               = { publicKey: '1' };
        del2               = { publicKey: '3' };
        account.delegates  = ['1', '2'];
        delegatesFromQuery = [del1, del2].map((d, idx) => ({
          delegate: new accountsModel(d), info: {
            rate        : idx,
            rank        : idx,
            approval    : 100,
            productivity: 100,
          },
        }));

        getAccountStub.resolves(new accountsModel(account));
        getDelegatesStub = sandbox.stub(delegatesModule, 'getDelegates')
          .resolves({ delegates: delegatesFromQuery });
      });

      it('should call delegatesModule.getDelegates', async () => {
        await instance.getDelegates(params);

        expect(getDelegatesStub.calledOnce).to.be.true;
        expect(getDelegatesStub.firstCall.args.length).to.be.equal(1);
        expect(getDelegatesStub.firstCall.args[0]).to.be.deep.equal({ orderBy: 'rank:desc' });
      });

      it('should return object with same delegates from account"s delegates', async () => {
        const ret = await instance.getDelegates(params);

        expect(ret).to.be.deep.equal({
          delegates: [
            {
              address       : null,
              approval      : 100,
              missedblocks  : undefined,
              producedblocks: undefined,
              productivity  : 100,
              rank          : 0,
              rate          : 0,
              username      : undefined,
              vote          : undefined,
              publicKey     : '1',
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
    let getFeesStub: SinonStub;
    beforeEach(() => {
      fee    = {
        fees: {
          delegate: 1,
        },
      };
      params = { height: 1 };
      getFeesStub = sandbox.stub(system, 'getFees').returns(fee);
    });

    it('should call systemModule.getFees', async () => {
      await instance.getDelegatesFee(params);

      expect(getFeesStub.calledOnce).to.be.true;
      expect(getFeesStub.firstCall.args.length).to.be.equal(1);
      expect(getFeesStub.firstCall.args[0]).to.be.equal(params.height);
    });

    it('should return delegates fee from height', async () => {
      const ret = await instance.getDelegatesFee(params);

      expect(ret).to.be.deep.equal({ fee: fee.fees.delegate });
    });

  });

  describe('addDelegate', () => {

    it('should throw error', async () => {
      await expect(instance.addDelegate()).to.be.rejectedWith('Method is deprecated');
    });

  });

});