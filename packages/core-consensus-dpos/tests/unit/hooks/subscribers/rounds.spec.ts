import { SnapshotBlocksCountFilter } from '@risevision/core';
import {
  ApplyBlockDBOps,
  CommonHeightsToQuery,
  RollbackBlockDBOps,
} from '@risevision/core-blocks';
import { createFakeBlock } from '@risevision/core-blocks/tests/unit/utils/createFakeBlocks';
import { Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { AppConfig } from '@risevision/core-types';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { dPoSSymbols } from '../../../../src/helpers';
import { RoundsHooks } from '../../../../src/hooks/subscribers';
import { RoundsModule } from '../../../../src/modules';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('hooks/subscribers/rounds', () => {
  let container: Container;
  let instance: RoundsHooks;
  let wphooksystem: WordPressHookSystem;
  let roundsModule: RoundsModule;
  let sandbox: SinonSandbox;
  before(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-consensus-dpos',
      'core-transactions',
      'core',
      'core-helpers',
      'core-crypto',
    ]);
    instance = container.get(dPoSSymbols.hooksSubscribers.rounds);
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
    const stub = sinon.stub(roundsModule, 'tick').resolves(['b', null, 'c']);
    const block = createFakeBlock(container);
    const r = await wphooksystem.apply_filters(
      ApplyBlockDBOps.name,
      ['a'],
      block
    );
    expect(stub.called).is.true;
    expect(stub.firstCall.args[0]).deep.eq(block);
    expect(r).deep.eq(['a', 'b', 'c']);
  });

  it('should call round backwardTick on block rollback and properly merge ops', async () => {
    const stub = sinon
      .stub(roundsModule, 'backwardTick')
      .resolves(['b', null, 'c']);
    const block = createFakeBlock(container);
    const block2 = createFakeBlock(container);
    const r = await wphooksystem.apply_filters(
      RollbackBlockDBOps.name,
      ['a'],
      block,
      block2
    );
    expect(stub.called).is.true;
    expect(stub.firstCall.args[0]).deep.eq(block);
    expect(stub.firstCall.args[1]).deep.eq(block2);
    expect(r).deep.eq(['a', 'b', 'c']);
  });

  describe('commonHeightList', () => {
    const vectors = [
      {
        atHeight: 1,
        expectHeights: [1],
      },
      {
        atHeight: 2,
        expectHeights: [2, 1],
      },
      {
        atHeight: 5,
        expectHeights: [5, 4, 3, 2, 1],
      },
      {
        atHeight: 6,
        expectHeights: [6, 5, 4, 3, 2, 1],
      },
      {
        atHeight: 10,
        expectHeights: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      },
      {
        atHeight: 100,
        expectHeights: [
          100,
          99,
          98,
          97,
          96,
          95,
          94,
          93,
          91,
          88,
          83,
          75,
          61,
          38,
        ],
      },
      {
        atHeight: 1000,
        expectHeights: [
          1000,
          999,
          998,
          997,
          996,
          995,
          993,
          991,
          986,
          974,
          949,
          896,
          781,
          533,
        ],
      },
      {
        atHeight: 10000,
        expectHeights: [
          10000,
          9999,
          9998,
          9997,
          9996,
          9995,
          9993,
          9988,
          9974,
          9936,
          9829,
          9531,
          8704,
          6403,
        ],
      },
    ];
    for (const vec of vectors) {
      it(`should work for height ${vec.atHeight}`, async () => {
        const res = await instance.commonHeightList([], vec.atHeight);
        expect(res).deep.eq(vec.expectHeights);
      });
    }
    it('should overwrite filter data and return proper heights', async () => {
      const res = await wphooksystem.apply_filters(
        CommonHeightsToQuery.name,
        ['banana'],
        2000000
      );
      expect(res).deep.eq([
        2000000,
        1999999,
        1999998,
        1999997,
        1999996,
        1999995,
        1999990,
        1999970,
        1999870,
        1999364,
        1996829,
        1984122,
        1920416,
        1601049,
      ]);
    });
  });

  describe('snapshotBlockCount', () => {
    let config: AppConfig;
    before(() => {
      config = container.get(Symbols.generic.appConfig);
    });
    it('should snapshot to lastIn(prevRound) if snapshot=true', async () => {
      config.loading.snapshot = true;
      const res = await wphooksystem.apply_filters(
        SnapshotBlocksCountFilter.name,
        2000000
      );
      expect(res).eq(1999901);
      expect(config.loading.snapshot).eq(19801);
    });
    it('should snapshot to lastIn(prevRound) if snapshot is outragous number', async () => {
      config.loading.snapshot = 1000000000;
      const res = await wphooksystem.apply_filters(
        SnapshotBlocksCountFilter.name,
        2000000
      );
      expect(res).eq(1999901);
      expect(config.loading.snapshot).eq(19801);
    });
  });
});
