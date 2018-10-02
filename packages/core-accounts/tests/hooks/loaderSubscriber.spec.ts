import { OnCheckIntegrity, RecreateAccountsTables } from '@risevision/core';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import * as path from 'path';
import { Op } from 'sequelize';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { AccountsLoaderSubscriber, AccountsModel, AccountsSymbols } from '../../src';

chai.use(chaiAsPromised);
describe('accounts/hooks/loaderSubscriber', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let accModel: typeof AccountsModel;
  let instance: AccountsLoaderSubscriber;
  let hookSystem: WordPressHookSystem;
  beforeEach(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-accounts', 'core-helpers']);
    accModel  = container.getNamed(ModelSymbols.model, AccountsSymbols.model);
    hookSystem  = new WordPressHookSystem(new InMemoryFilterModel());
    instance  = container.get(AccountsSymbols.__internal.loaderHooks);
    // de-register current hooks and register a new hooksystem to isolate tests.
    await instance.unHook();
    instance.hookSystem = hookSystem;
    delete instance.__wpuid;
    await instance.hookMethods();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should recreate accts table on proper hook', async () =>{
    const dropStub = sandbox.stub(accModel, 'drop').resolves();
    const queryStub = sandbox.stub(accModel.sequelize, 'query').resolves();
    await hookSystem.do_action(RecreateAccountsTables.name);
    expect(dropStub.calledOnce).is.true;
    expect(queryStub.calledOnce).is.true;
    expect(queryStub.calledWith(fs.readFileSync(path.join(__dirname, '..', '..', 'sql', 'memoryTables.sql'), { encoding: 'utf8' })))
  });
  describe('integrity hook', () => {
    let accountsCountStub: SinonStub;
    let queryStub: SinonStub;
    beforeEach(() => {
      accountsCountStub = sandbox.stub(accModel, 'count').resolves(1);
      queryStub = sandbox.stub(accModel.sequelize, 'query').resolves([]);
    });
    it('should fail if no accounts where updated on last block', async () => {
      accountsCountStub.resolves(0);
      await expect(hookSystem.do_action(OnCheckIntegrity.name, 1))
        .rejectedWith('Detected missed blocks in mem_accounts');

      expect(accountsCountStub.firstCall.args[0]).deep.eq({
        where: { blockId: {} },
      });
      expect(
        accountsCountStub.firstCall.args[0].where.blockId[Op.in]
      ).deep.eq({
        val: '(SELECT "id" from blocks ORDER BY "height" DESC LIMIT 1)',
      });
    });
    it('should call load if there are some orphanedMemAccounts', async () => {
      queryStub.resolves(['a']);
      await expect(hookSystem.do_action(OnCheckIntegrity.name, 1))
        .rejectedWith('Detected orphaned blocks in mem_accounts');
      expect(queryStub.firstCall.args[0]).to.be.deep.eq(
        'SELECT a."blockId", b."id" FROM mem_accounts a LEFT OUTER JOIN blocks b ON b."id" = a."blockId" WHERE a."blockId" IS NOT NULL AND a."blockId" != \'0\' AND b."id" IS NULL\n'
      );
    });
  });

});
