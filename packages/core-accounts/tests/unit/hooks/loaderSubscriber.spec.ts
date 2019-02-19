// tslint:disable no-unused-expression
import { OnCheckIntegrity, RecreateAccountsTables } from '@risevision/core';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import * as path from 'path';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import {
  AccountsLoaderSubscriber,
  AccountsModel,
  AccountsSymbols,
} from '../../../src';

chai.use(chaiAsPromised);
describe('accounts/hooks/loaderSubscriber', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let accModel: typeof AccountsModel;
  let instance: AccountsLoaderSubscriber;
  let hookSystem: WordPressHookSystem;
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-accounts',
      'core-helpers',
      'core-crypto',
      'core-transactions',
    ]);
    accModel = container.getNamed(ModelSymbols.model, AccountsSymbols.model);
    hookSystem = new WordPressHookSystem(new InMemoryFilterModel());
    instance = container.get(AccountsSymbols.__internal.loaderHooks);
    // de-register current hooks and register a new hooksystem to isolate tests.
    await instance.unHook();
    instance.hookSystem = hookSystem;
    delete instance.__wpuid;
    await instance.hookMethods();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should recreate accts table on proper hook', async () => {
    const dropStub = sandbox.stub(accModel, 'truncate').resolves();
    await hookSystem.do_action(RecreateAccountsTables.name);
    expect(dropStub.calledOnce).is.true;
  });
});
