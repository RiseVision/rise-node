import { Container } from 'inversify';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { RoundsHooks } from '../../../src/hooks/subscribers';
import { dPoSSymbols } from '../../../src/helpers';
import { WordPressHookSystem, InMemoryFilterModel } from 'mangiafuoco';
import { OnPostApplyBlock } from '@risevision/core-blocks';
import { createFakeBlock } from '@risevision/core-blocks/tests/utils/createFakeBlocks';
import { Symbols } from '@risevision/core-interfaces';
import { RoundsModule } from '../../../src/modules';
import { RoundsModel } from '../../../src/models';
import { ModelSymbols } from '@risevision/core-models';
import { SinonSandbox } from 'sinon';
import { OnCheckIntegrity, SnapshotBlocksCountFilter, UtilsCommonHeightList } from '@risevision/core';
import { AppConfig } from '@risevision/core-types';

chai.use(chaiAsPromised);

describe('hooks/subscribers/rounds', () => {
  let container: Container;
  let instance: RoundsHooks;
  let wphooksystem: WordPressHookSystem;
  let roundsModule: RoundsModule;
  let roundsModel: typeof RoundsModel;
  let sandbox: SinonSandbox;
  before(async () => {
    sandbox      = sinon.createSandbox();
    container    = await createContainer(['core-consensus-dpos', 'core-transactions', 'core', 'core-helpers']);
    instance     = container.get(dPoSSymbols.hooksSubscribers.rounds);
    wphooksystem = new WordPressHookSystem(new InMemoryFilterModel());
    roundsModule = container.get(dPoSSymbols.modules.rounds);
    roundsModel  = container.getNamed(ModelSymbols.model, dPoSSymbols.models.rounds);
    await instance.unHook();
    delete instance.__wpuid;
    instance.hookSystem = wphooksystem;
    await instance.hookMethods();
  });
  beforeEach(() => {
    sandbox.restore();
  });

  it('should call round tick OnPostApply with proper data', async () => {
    const stub  = sinon.stub(roundsModule, 'tick').resolves();
    const block = createFakeBlock(container);
    await wphooksystem.do_action(OnPostApplyBlock.name, block, { tx: 'ciao' });
    expect(stub.called).is.true;
    expect(stub.firstCall.args[0]).deep.eq(block);
    expect(stub.firstCall.args[1]).deep.eq({ tx: 'ciao' });
  });

  it('should throw in OnCheckIntegrity if there is some unapplied round in db', async () => {
    const stub = sandbox.stub(roundsModel, 'findAll').resolves([{ round: 11 }]);
    await wphooksystem.do_action(OnCheckIntegrity.name, 10 * 101 + 1);

    stub.resolves([{ round: 10 }, { round: 11 }]);

    await expect(wphooksystem.do_action(OnCheckIntegrity.name, 10 * 101 + 1))
      .rejectedWith('Detected unapplied rounds in mem_round');
  });

  it('commonHeightList should overwrite filter data and return proper heights', async () => {
    const res = await wphooksystem
      .apply_filters(UtilsCommonHeightList.name, ['banana'], 2000000);
    expect(res).deep.eq([1999902, 1999801, 1999700, 1999599, 1999498]);
  });

  describe('snapshotBlockCount', () => {
    let config: AppConfig;
    before(() => {
      config = container.get(Symbols.generic.appConfig);
    });
    it('should snapshot to lastIn(prevRound) if snapshot=true', async () => {
      config.loading.snapshot = true;
      const res = await wphooksystem.apply_filters(SnapshotBlocksCountFilter.name, 2000000);
      expect(res).eq(1999901);
      expect(config.loading.snapshot).eq(19801);
    });
    it('should snapshot to lastIn(prevRound) if snapshot is outragous number', async () => {
      config.loading.snapshot = 1000000000;
      const res = await wphooksystem.apply_filters(SnapshotBlocksCountFilter.name, 2000000);
      expect(res).eq(1999901);
      expect(config.loading.snapshot).eq(19801);
    });
  });
});
