import { OnCheckIntegrity } from '@risevision/core';
import { AccountsModel, AccountsSymbols } from '@risevision/core-accounts';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { dPoSSymbols } from '../../../../src/helpers';
import { DelegatesHooks } from '../../../../src/hooks/subscribers';
import { DelegatesModel } from '../../../../src/models';

chai.use(chaiAsPromised);

// tslint:disable no-identical-functions
describe('hooks/subscribers/delegates', () => {
  let container: Container;
  let instance: DelegatesHooks;
  let wphooksystem: WordPressHookSystem;
  let sandbox: SinonSandbox;
  let accountsModel: typeof AccountsModel;
  let delegatesModel: typeof DelegatesModel;
  before(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-consensus-dpos',
      'core-transactions',
      'core',
      'core-helpers',
      'core-crypto',
    ]);
    instance = container.get(dPoSSymbols.hooksSubscribers.delegates);
    wphooksystem = new WordPressHookSystem(new InMemoryFilterModel());
    accountsModel = container.getNamed(
      ModelSymbols.model,
      AccountsSymbols.model
    );
    delegatesModel = container.getNamed(
      ModelSymbols.model,
      dPoSSymbols.models.delegates
    );
    await instance.unHook();
    delete instance.__wpuid;
    instance.hookSystem = wphooksystem;
    await instance.hookMethods();
  });
  beforeEach(() => {
    sandbox.restore();
  });

  // it('should throw in OnCheckIntegrity if there is some unapplied round in db', async () => {
  //   const queryStub = sandbox
  //     .stub(delegatesModel.sequelize, 'query')
  //     .resolves([{ count: 1 }]);
  //   const stub = sandbox.stub(accountsModel, 'count').resolves(0);
  //   await expect(wphooksystem.do_action(OnCheckIntegrity.name, 1)).rejectedWith(
  //     'No delegates found'
  //   );
  //
  //   stub.resolves(1);
  //   await expect(wphooksystem.do_action(OnCheckIntegrity.name, 1)).rejectedWith(
  //     'Delegates table corrupted with duplicated entries'
  //   );
  //
  //   // all good
  //   queryStub.resolves([{ count: 0 }]);
  //   await wphooksystem.do_action(OnCheckIntegrity.name, 1);
  // });

  describe('verifyReceipt', () => {
    it('should add error if block is too old');
    it('should add error if block is in the future');
    it('should add error if block is from wrong generator');
    it('should not add any error if block was already marked as unverified');
  });

  describe('verifyBlock', () => {
    it('should add error if block is from wrong generator');
    it('should add error if block has slot less than lastblockslot');
    it('should add error if block has slot in future');
    it('should not add any error if block was already marked as unverified');
  });
});
