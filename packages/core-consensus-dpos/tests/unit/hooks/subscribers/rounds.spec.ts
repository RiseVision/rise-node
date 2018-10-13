import { Container } from 'inversify';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { RoundsHooks } from '../../../../src/hooks/subscribers';
import { dPoSSymbols } from '../../../../src/helpers';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import { createFakeBlock } from '@risevision/core-blocks/tests/unit/utils/createFakeBlocks';
import { Symbols } from '@risevision/core-interfaces';
import { RoundsModule } from '../../../../src/modules';
import { SnapshotBlocksCountFilter, UtilsCommonHeightList } from '@risevision/core';
import { AppConfig } from '@risevision/core-types';
import { ApplyBlockDBOps, RollbackBlockDBOps } from '@risevision/core-blocks';

chai.use(chaiAsPromised);

describe('hooks/subscribers/rounds', () => {
  let container: Container;
  let instance: RoundsHooks;
  let wphooksystem: WordPressHookSystem;
  let roundsModule: RoundsModule;
  let sandbox: SinonSandbox;
  before(async () => {
    sandbox      = sinon.createSandbox();
    container    = await createContainer(['core-consensus-dpos', 'core-transactions', 'core', 'core-helpers']);
    instance     = container.get(dPoSSymbols.hooksSubscribers.rounds);
    wphooksystem = new WordPressHookSystem(new InMemoryFilterModel());
    roundsModule = container.get(dPoSSymbols.modules.rounds);
    await instance.unHook();
    delete instance.__wpuid;
    instance.hookSystem = wphooksystem;
    await instance.hookMethods();
  });
  beforeEach(() => {
    sandbox.restore();
  });

  it('should call round tick ApplyBlockDBOps with proper data', async () => {
    const stub  = sinon.stub(roundsModule, 'tick').resolves(['b', null, 'c']);
    const block = createFakeBlock(container);
    const r     = await wphooksystem.apply_filters(ApplyBlockDBOps.name, ['a'], block);
    expect(stub.called).is.true;
    expect(stub.firstCall.args[0]).deep.eq(block);
    expect(r).deep.eq(['a', 'b', 'c']);
  });

  it('should call round backwardTick on block rollback and properly merge ops', async () => {
    const stub   = sinon.stub(roundsModule, 'backwardTick').resolves(['b', null, 'c']);
    const block  = createFakeBlock(container);
    const block2 = createFakeBlock(container);
    const r      = await wphooksystem.apply_filters(RollbackBlockDBOps.name, ['a'], block, block2);
    expect(stub.called).is.true;
    expect(stub.firstCall.args[0]).deep.eq(block);
    expect(stub.firstCall.args[1]).deep.eq(block2);
    expect(r).deep.eq(['a', 'b', 'c']);
  })

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
      const res               = await wphooksystem.apply_filters(SnapshotBlocksCountFilter.name, 2000000);
      expect(res).eq(1999901);
      expect(config.loading.snapshot).eq(19801);
    });
    it('should snapshot to lastIn(prevRound) if snapshot is outragous number', async () => {
      config.loading.snapshot = 1000000000;
      const res               = await wphooksystem.apply_filters(SnapshotBlocksCountFilter.name, 2000000);
      expect(res).eq(1999901);
      expect(config.loading.snapshot).eq(19801);
    });
  });
});
