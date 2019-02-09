import { APISymbols } from '@risevision/core-apis';
import {
  IAccountsModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { AccountsAPI } from '../../../src/apis';
import { dPoSSymbols } from '../../../src/helpers';
import { AccountsModelForDPOS } from '../../../src/models';
import { DelegatesModule } from '../../../src/modules';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

describe('apis/accountsAPI', function () {
  // TODO: Move all this to integration tests.
  this.timeout(10000);
  // let sandbox: SinonSandbox;
  // let container: Container;
  // let instance: AccountsAPI;
  // let accounts: IAccountsModule;
  // let delegatesModule: DelegatesModule;
  // let accountsModel: typeof AccountsModelForDPOS;
  // let system: ISystemModule;
  // before(async () => {
  //   sandbox = sinon.createSandbox();
  //   container = await createContainer([
  //     'core-consensus-dpos',
  //     'core-helpers',
  //     'core-crypto',
  //     'core',
  //   ]);
  //   accountsModel = container.getNamed(
  //     ModelSymbols.model,
  //     Symbols.models.accounts
  //   );
  //   accounts = container.get(Symbols.modules.accounts);
  //   delegatesModule = container.get(dPoSSymbols.modules.delegates);
  //   system = container.get(Symbols.modules.system);
  //   instance = container.getNamed(APISymbols.class, dPoSSymbols.accountsAPI);
  // });
  //
  // afterEach(() => {
  //   sandbox.restore();
  // });
  //
  // describe('getVoters', () => {
  //   let params;
  //   let account;
  //   let getAccountStub: SinonStub;
  //   beforeEach(() => {
  //     params = { address: '1R' };
  //     account = { publicKey: '1' };
  //     getAccountStub = sandbox.stub(accounts, 'getAccount').resolves(account);
  //   });
  //
  //   it('should call accountsModule.getAccount', async () => {
  //     await instance.getDelegates(params);
  //
  //     expect(getAccountStub.calledOnce).to.be.true;
  //     expect(getAccountStub.firstCall.args.length).to.be.equal(1);
  //     expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({
  //       address: '1R',
  //     });
  //   });
  //
  //   it('should throw error if account not found', async () => {
  //     getAccountStub.resolves();
  //     await expect(instance.getDelegates(params)).to.be.rejectedWith(
  //       'Account not found'
  //     );
  //   });
  //
  //   describe('account.delegates is not null', () => {
  //     let delegatesFromQuery;
  //     let del1;
  //     let del2;
  //     let getDelegatesStub: SinonStub;
  //     beforeEach(() => {
  //       del1 = { username: '1', forgingPK: Buffer.alloc(1).fill(1) };
  //       del2 = { username: '3', forgingPK: Buffer.alloc(1).fill(2) };
  //       account.delegates = ['1', '2'];
  //       delegatesFromQuery = [del1, del2].map((d, idx) => ({
  //         delegate: new accountsModel(d),
  //         info: {
  //           approval: 100,
  //           productivity: 100,
  //           rank: idx,
  //           rate: idx,
  //         },
  //       }));
  //
  //       getAccountStub.resolves(new accountsModel(account));
  //       getDelegatesStub = sandbox
  //         .stub(delegatesModule, 'getDelegates')
  //         .resolves({ delegates: delegatesFromQuery });
  //     });
  //
  //     it('should call delegatesModule.getDelegates', async () => {
  //       await instance.getDelegates(params);
  //
  //       expect(getDelegatesStub.calledOnce).to.be.true;
  //       expect(getDelegatesStub.firstCall.args.length).to.be.equal(1);
  //       expect(getDelegatesStub.firstCall.args[0]).to.be.deep.equal({
  //         orderBy: 'rank:desc',
  //       });
  //     });
  //
  //     it('should return object with same delegates from account"s delegates', async () => {
  //       const ret = await instance.getDelegates(params);
  //
  //       expect(ret).to.be.deep.equal({
  //         delegates: [
  //           {
  //             address: null,
  //             approval: 100,
  //             missedblocks: undefined,
  //             producedblocks: undefined,
  //             productivity: 100,
  //             publicKey: '01',
  //             rank: 0,
  //             rate: 0,
  //             username: '1',
  //             vote: undefined,
  //           },
  //         ],
  //       });
  //     });
  //   });
  //
  //   it('should return object with publicKey if account.delegates is null', async () => {
  //     const ret = await instance.getDelegates(params);
  //
  //     expect(ret).to.be.deep.equal({ delegates: [] });
  //   });
  // });
  //
  // describe('addDelegate', () => {
  //   it('should throw error', async () => {
  //     await expect(instance.addDelegate()).to.be.rejectedWith(
  //       'Method is deprecated'
  //     );
  //   });
  // });
});
