import {
  IAccountsModel,
  IBlockLogic,
  IBlocksModel,
  ISequence,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { Op } from 'sequelize';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { BlocksModule, BlocksModuleUtils, BlocksSymbols } from '../../../src';

// tslint:disable no-unused-expression max-line-length no-big-function
chai.use(chaiAsPromised);

describe('modules/utils', () => {
  let inst: BlocksModuleUtils;
  let container: Container;
  beforeEach(async () => {
    container = await createContainer([
      'core-blocks',
      'core-helpers',
      'core-crypto',
      'core',
      'core-accounts',
      'core-transactions',
    ]);

    inst = container.get(BlocksSymbols.modules.utils);
  });

  let blocksModule: BlocksModule;

  let genesisBlock: SignedAndChainedBlockType;

  let dbSequence: ISequence;

  let blockLogic: IBlockLogic;
  let txLogic: ITransactionLogic;

  let blocksModel: typeof IBlocksModel;
  let accountsModel: typeof IAccountsModel;
  let sandbox: SinonSandbox;
  beforeEach(() => {
    blocksModule = container.get(Symbols.modules.blocks);
    genesisBlock = container.get(Symbols.generic.genesisBlock);
    dbSequence = container.getNamed(
      Symbols.helpers.sequence,
      Symbols.names.helpers.dbSequence
    );

    blockLogic = container.get(Symbols.logic.block);
    txLogic = container.get(Symbols.logic.transaction);

    accountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );
    blocksModel = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
    sandbox = sinon.createSandbox();
  });
  afterEach(() => sandbox.restore());

  describe('loadBlocksPart', () => {
    it('should call loadBlocksData with given filter and pass result to readDbRows', async () => {
      const loadBlocksStub = sandbox
        .stub(inst, 'loadBlocksData')
        .resolves(['1', '2', '3']);

      const res = await inst.loadBlocksPart({ limit: 1, id: 'id' });
      expect(loadBlocksStub.calledOnce).is.true;

      expect(res).to.be.deep.eq(['1', '2', '3']);
    });
  });

  describe('loadLastBlock', () => {
    let findOneStub: SinonStub;
    beforeEach(() => {
      findOneStub = sandbox.stub(blocksModel, 'findOne').resolves({});
      (inst as any).TransactionsModel = 'txModel' as any; // useful for chai deep equality.
    });
    it('should query db', async () => {
      await inst.loadLastBlock();
      expect(findOneStub.called).is.true;
      expect(findOneStub.firstCall.args[0]).deep.eq({
        include: ['txModel'],
        limit: 1,
        order: [['height', 'DESC']],
      });
    });
    it('should call txLogic.attachAssets over block txs', async () => {
      const attachAssetsStub = sandbox.stub(txLogic, 'attachAssets');
      findOneStub.resolves({ transactions: ['a', 'b'] });
      await inst.loadLastBlock();
      expect(attachAssetsStub.calledOnce).is.true;
      expect(attachAssetsStub.firstCall.args[0]).deep.eq(['a', 'b']);
    });
    it('should set blocksModule.lastBlock to lastloadedBlock', async () => {
      findOneStub.resolves({ id: '1', transactions: [] });
      await inst.loadLastBlock();
      expect(blocksModule.lastBlock).to.be.deep.eq({
        id: '1',
        transactions: [],
      });
    });
  });

  describe('getHeightSequence', () => {
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
      {
        atHeight: 2000000,
        expectHeights: [
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
        ],
      },
    ];
    for (const vec of vectors) {
      it(`should work for height ${vec.atHeight}`, () => {
        const res = inst.getHeightsSequence(vec.atHeight);
        expect(res).deep.eq(vec.expectHeights);
      });
    }
  });

  describe('getIdSequence', () => {
    let dbReturn: any;
    let findAllStub: SinonStub;
    let getHeightsSequenceStub: SinonStub;

    beforeEach(async () => {
      dbReturn = [{ id: '2', height: 3 }];
      findAllStub = sandbox.stub(blocksModel, 'findAll').resolves(dbReturn);
      getHeightsSequenceStub = sandbox.stub(inst, 'getHeightsSequence');
    });

    it('should query db using correct params also derived from filter.', async () => {
      getHeightsSequenceStub.returns([1, 2, 3, 4, 5]);
      await inst.getIdSequence(2000000);
      expect(findAllStub.called).is.true;
      expect(findAllStub.firstCall.args[0]).deep.eq({
        attributes: ['id', 'height'],
        order: [['height', 'DESC']],
        raw: true,
        where: {
          height: [1, 2, 3, 4, 5],
        },
      });
    });
    it('should throw error if theres no result for such height', async () => {
      findAllStub.resolves([]);
      await expect(inst.getIdSequence(10)).to.be.rejectedWith(
        'Failed to get id sequence for height 10'
      );
    });
    it('should prepend lastblockid', async () => {
      blocksModule.lastBlock = { id: '123', height: 50 } as any;
      const res = await inst.getIdSequence(10);
      expect(res.ids[0]).to.be.eq('123');
    });
    it('should append genesisblock', async () => {
      const genesis: SignedAndChainedBlockType = container.get(
        Symbols.generic.genesisBlock
      );
      blocksModule.lastBlock = { id: '123', height: 50 } as any;
      const res = await inst.getIdSequence(10);
      expect(res.ids[2]).to.be.eq(genesis.id);
    });

    it('should not prepend twice lastblockid if already from sql', async () => {
      const genesis: SignedAndChainedBlockType = container.get(
        Symbols.generic.genesisBlock
      );
      blocksModule.lastBlock = { id: '123', height: 50 } as any;
      dbReturn.push(blocksModule.lastBlock);
      const res = await inst.getIdSequence(10);
      expect(res.ids).to.be.deep.eq(['2', '123', genesis.id]);
    });
    it('should not append genesis if already from sql', async () => {
      const genesis: SignedAndChainedBlockType = container.get(
        Symbols.generic.genesisBlock
      );
      blocksModule.lastBlock = { id: '123', height: 50 } as any;
      dbReturn.push(genesisBlock);
      const res = await inst.getIdSequence(10);
      expect(res.ids).to.be.deep.eq(['123', '2', genesis.id]);
    });
  });
  describe('loadBlocksData', () => {
    let findOneStub: SinonStub;
    let findAllStub: SinonStub;
    let dbSequenceStub: SinonStub;
    beforeEach(() => {
      findOneStub = sandbox
        .stub(blocksModel, 'findOne')
        .resolves({ height: 10 });
      findAllStub = sandbox
        .stub(blocksModel, 'findAll')
        .resolves([{ height: 11 }, { height: 12 }]);
      dbSequenceStub = sandbox
        .stub(dbSequence, 'addAndPromise')
        .callsFake((b) => b());
      (inst as any).TransactionsModel = 'txModel' as any;
    });
    it('should disallow passing both id and lastId', async () => {
      await expect(
        inst.loadBlocksData({ id: '1', lastId: '2' })
      ).to.be.rejectedWith('Invalid filter');
    });
    it('should wrap queries within dbSequence', async () => {
      await inst.loadBlocksData({ id: '1' });
      expect(dbSequenceStub.called).is.true;
      expect(dbSequenceStub.calledBefore(findOneStub)).is.true;
      expect(dbSequenceStub.calledBefore(findAllStub)).is.true;
    });
    it('should query height by id.', async () => {
      await inst.loadBlocksData({ id: '1' });
      expect(findOneStub.firstCall.args[0]).to.be.deep.eq({
        include: ['txModel'],
        where: { id: '1' },
      });
    });
    it('should query db correctly based on input and height output', async () => {
      await inst.loadBlocksData({ lastId: '1', limit: 2 });
      expect(findAllStub.firstCall.args[0]).to.be.deep.eq({
        include: ['txModel'],
        order: ['height', 'rowId'],
        where: { height: { [Op.gt]: 10, [Op.lt]: 10 + 2 } },
      });
      expect(findAllStub.firstCall.args[0].where.height[Op.gt]).eq(10);
      expect(findAllStub.firstCall.args[0].where.height[Op.lt]).eq(10 + 2);
    });
    it('should remap error to Blocks#loadBlockData error', async () => {
      findAllStub.rejects(new Error('meow'));
      await expect(inst.loadBlocksData({ lastId: '1' })).to.be.rejectedWith(
        'Blocks#loadBlockData error'
      );
    });
  });

  describe('getBlockProgressLogger', () => {
    it('should return BlockProgresslogger with given arguments', async () => {
      const res = inst.getBlockProgressLogger(10, 5, 'msg');
      // tslint:disable no-string-literal
      expect(res['target']).is.eq(10);
      expect(res['step']).is.eq(2);
    });
  });
  //
  // describe('aggregateBlockReward', () => {
  //   let findOneStub: SinonStub;
  //   let aggregateFeesStub: SinonStub;
  //   let findAccountStub: SinonStub;
  //   beforeEach(() => {
  //     findOneStub = sandbox.stub(blocksModel, 'findOne').resolves({count: 1, rewards: 3});
  //     aggregateFeesStub = sandbox.stub(roundsFeesModel, 'aggregate').resolves(2);
  //     findAccountStub = sandbox.stub(accountsModel, 'findOne').resolves({acc: 'acc'})
  //   });
  //   it('should allow specify start time in unix timestamp', async () => {
  //     const constants = container.get<any>(Symbols.helpers.constants);
  //     await inst.aggregateBlockReward({
  //       generatorPublicKey: 'aabb',
  //       start             : Math.floor(constants.epochTime.getTime() / 1000 + 1000),
  //     });
  //     expect(findOneStub.called).is.true;
  //     expect(findOneStub.firstCall.args[0]).to.be.deep.eq({
  //       attributes: [ {val: 'COUNT(1)'}, {val: 'SUM("reward") as rewards' }],
  //       raw: true,
  //       where: {
  //         generatorPublicKey: Buffer.from('aabb', 'hex'),
  //         timestamp: { [Op.gte]: 1000},
  //       },
  //     });
  //     expect(findOneStub.firstCall.args[0].where.timestamp[Op.gte]).eq(1000);
  //   });
  //   it('should allow specify end time in unix timestamp', async () => {
  //     const constants = container.get<any>(Symbols.helpers.constants);
  //     await inst.aggregateBlockReward({
  //       end               : Math.floor(constants.epochTime.getTime() / 1000 + 1000),
  //       generatorPublicKey: 'aabb',
  //     });
  //     expect(findOneStub.called).is.true;
  //     expect(findOneStub.firstCall.args[0]).to.be.deep.eq({
  //       attributes: [ {val: 'COUNT(1)'}, {val: 'SUM("reward") as rewards' }],
  //       raw: true,
  //       where: {
  //         generatorPublicKey: Buffer.from('aabb', 'hex'),
  //         timestamp: { [Op.lte]: 1000},
  //       },
  //     });
  //     expect(findOneStub.firstCall.args[0].where.timestamp[Op.lte]).eq(1000);
  //   });
  //   it('should issue db query and use that as result', async () => {
  //     const res = await inst.aggregateBlockReward({
  //       generatorPublicKey: 'abc',
  //     });
  //
  //     expect(res).to.be.deep.eq({
  //       count  : 1, // defaulted to zero
  //       fees   : 2,
  //       rewards: 3,
  //     });
  //   });
  //   it('should throw error if returned data shows delegate does not exist', async () => {
  //     findAccountStub.resolves(null);
  //     await expect(inst.aggregateBlockReward({ generatorPublicKey: 'abc' }))
  //       .to.be.rejectedWith('Account not found or is not a delegate');
  //   });
  // });
});
