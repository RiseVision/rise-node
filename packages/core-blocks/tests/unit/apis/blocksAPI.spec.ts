import { APISymbols } from '@risevision/core-apis';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import {
  IBlocksModel,
  ISystemModule,
  ITimeToEpoch,
  ITransactionsModel,
  SignedBlockType,
  Symbols,
} from '@risevision/core-types';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { Op } from 'sequelize';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { BlocksConstantsType, BlocksModule, BlocksSymbols } from '../../../src';
import { BlocksAPI } from '../../../src/apis/blocksAPI';
import { createFakeBlock } from '../utils/createFakeBlocks';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length no-big-function

describe('apis/blocksAPI', () => {
  let sandbox: SinonSandbox;
  let instance: BlocksAPI;
  let blocksModule: BlocksModule;
  let container: Container;
  let fakeBlock: SignedBlockType;
  let blocksModel: typeof IBlocksModel;
  before(async () => {
    container = await createContainer([
      'core-blocks',
      'core-helpers',
      'core-crypto',
      'core',
      'core-accounts',
      'core-apis',
      'core-transactions',
    ]);
    const constants = container.get<BlocksConstantsType>(
      BlocksSymbols.constants
    );
    constants.rewards = [
      { fromHeight: 1, reward: '0' },
      { fromHeight: 10, reward: '1500000000' },
      { fromHeight: 11, reward: '30000000' },
      { fromHeight: 12, reward: '20000000' },
      { fromHeight: 13, reward: '1500000000' },
      { fromHeight: 1054080, reward: '1200000000' },
      { fromHeight: 1054080 * 2, reward: '900000000' },
      { fromHeight: 1054080 * 3, reward: '600000000' },
      { fromHeight: 1054080 * 4, reward: '300000000' },
      { fromHeight: 1054080 * 5, reward: '100000000' },
    ];
  });
  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    instance = container.getNamed(APISymbols.class, BlocksSymbols.api.api);
    blocksModule = container.get(BlocksSymbols.modules.blocks);
    blocksModel = container.getNamed(ModelSymbols.model, BlocksSymbols.model);
    fakeBlock = createFakeBlock(container);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getBlocks', () => {
    let defaultFindAndCountAllParams;
    let findAllStub: SinonStub;
    let txfindAllStub: SinonStub;
    let TxModel: typeof ITransactionsModel;
    beforeEach(() => {
      TxModel = container.getNamed(
        ModelSymbols.model,
        Symbols.models.transactions
      );
      defaultFindAndCountAllParams = {
        // include: [TxModel],
        limit: 100,
        offset: 0,
        order: [['height', 'desc']],
        raw: true,
      };
      findAllStub = sandbox
        .stub(blocksModel, 'findAndCountAll')
        .resolves({ rows: [], count: 0 });
      txfindAllStub = sandbox
        .stub(TxModel, 'findAll')
        .resolves([{ a: 'a' }, { b: 'b' }]);
    });
    it('should filter by generatorPublicKey', async () => {
      await instance.getBlocks({
        generatorPublicKey: Buffer.alloc(32)
          .fill(0xaa)
          .toString('hex'),
      });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).to.be.deep.eq({
        ...defaultFindAndCountAllParams,
        where: {
          generatorPublicKey: Buffer.alloc(32).fill(0xaa),
        },
      });
    });
    it('should filter by height', async () => {
      await instance.getBlocks({ height: 2 });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        where: { height: 2 },
      });
    });

    it('should filter by previousBlock', async () => {
      await instance.getBlocks({ previousBlock: '123456' });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        where: { previousBlock: '123456' },
      });
    });

    it('should filter by reward', async () => {
      await instance.getBlocks({ reward: 10 });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        where: { reward: 10 },
      });
    });

    it('should filter by totalAmount', async () => {
      await instance.getBlocks({ totalAmount: 10 });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        where: { totalAmount: 10 },
      });
    });

    it('should filter by totalFee', async () => {
      await instance.getBlocks({ totalFee: 10 });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        where: { totalFee: 10 },
      });
    });

    it('should honorate orderBy clause', async () => {
      await instance.getBlocks({ orderBy: 'height:asc' });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        order: [['height', 'asc']],
        where: {},
      });
    });

    it('should honorate limit clause', async () => {
      await instance.getBlocks({ limit: 10 });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        limit: 10,
        where: {},
      });
    });

    it('should honorate offset clause', async () => {
      await instance.getBlocks({ offset: 10 });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        offset: 10,
        where: {},
      });
    });

    // TODO: create core-transactions test util to create send transactions
    // it('should remap object to string block type', async () => {
    //   findAllStub.resolves({rows: [fakeBlock, fakeBlock], count: 3});
    //   fakeBlock.transactions = [{a: 'a'}, {b: 'b'}] as any;
    //   const stringFakeBlock = blocksModel.toStringBlockType(fakeBlock);
    //   const result = await instance.getBlocks({ offset: 10 });
    //   expect(result).to.be.deep.eq({
    //     blocks: [stringFakeBlock, stringFakeBlock],
    //     count: 3,
    //   });
    // });
  });

  describe('getBlock', () => {
    let filters: any;
    let rows;
    let block;

    beforeEach(async () => {
      block = {};
      rows = [{}, {}];
      filters = { id: '12345' };
    });

    it('should call dbSequence.addAndPromise', async () => {
      sandbox.stub(blocksModel, 'findById').resolves(fakeBlock);
      await instance.getBlock(filters);
    });

    it('should call blocksModel.findById', async () => {
      const findByIdStub = sandbox
        .stub(blocksModel, 'findById')
        .resolves(fakeBlock);
      await instance.getBlock(filters);
      expect(findByIdStub.calledOnce).is.true;
    });

    it('should throw error if rows.length === 0', async () => {
      sandbox.stub(blocksModel, 'findById').resolves(null);
      await expect(instance.getBlock(filters)).to.be.rejectedWith(
        'Block not found'
      );
    });

    it('should return stringified block from an id', async () => {
      sandbox.stub(blocksModel, 'findById').resolves(fakeBlock);
      const ret = await instance.getBlock(filters);

      expect(ret).to.be.deep.equal({
        block: blocksModel.toStringBlockType(fakeBlock),
      });
    });
  });

  describe('getHeight', () => {
    it('should return height', async () => {
      blocksModule.lastBlock = { height: 5 } as any;

      const ret = await instance.getHeight();

      expect(ret).to.be.deep.equal({ height: 5 });
    });
  });
  //
  describe('getBroadHash', () => {
    it('should return a broadhash', async () => {
      blocksModule.lastBlock = { id: 'someId' } as any;

      const ret = await instance.getBroadHash();

      expect(ret).to.be.deep.equal({ broadhash: 'someId' });
    });
  });
  //
  describe('getEpoch', () => {
    it('should return an epoch', () => {
      const ret = instance.getEpoch();
      const epoch = new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0));

      expect(ret).to.be.deep.equal({ epoch });
    });
  });

  describe('getFee', () => {
    it('should call systemModule.getFees', async () => {
      const res = await instance.getFee({ height: 1 });
      expect(res).deep.eq({
        fee: 10000000n,
        fromHeight: 1,
        height: 1,
        toHeight: null,
      });
    });

    it('should return fee from height', async () => {
      const ret = await instance.getFee({ height: 10000 });

      expect(ret).deep.eq({
        fee: 10000000n,
        fromHeight: 1,
        height: 10000,
        toHeight: null,
      });
    });
  });

  describe('getFees', () => {
    it('should call systemModule.getFees and return result', async () => {
      const params = { height: 1 };

      const ret = await instance.getFees(params);

      expect(ret).to.be.deep.equal({
        fees: {
          delegate: 2500000000n,
          multisignature: 500000000n,
          secondsignature: 500000000n,
          send: 10000000n,
          sendDataMultiplier: 1000000n,
          vote: 100000000n,
        },
        fromHeight: 1,
        height: 1,
        toHeight: null,
      });
    });
  });

  describe('getNethash', () => {
    it('should call systemModule.getNethash and return object', () => {
      const ret = instance.getNethash();

      expect(ret).to.be.deep.equal({
        nethash:
          'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
      });
    });
  });
  //
  describe('getMilestone', () => {
    it('should call blockRewardLogic.calcMilestone and return object', () => {
      const previousBlock = createFakeBlock(container);
      previousBlock.height = 2000000;
      blocksModule.lastBlock = createFakeBlock(container, {
        previousBlock: previousBlock as any,
      }) as any;
      const ret = instance.getMilestone();

      expect(ret).to.be.deep.equal({ milestone: 5 });
    });
  });
  //
  describe('getReward', () => {
    it('should call blockRewardLogic.calcReward and return object', () => {
      const previousBlock = createFakeBlock(container);
      previousBlock.height = 499;
      blocksModule.lastBlock = createFakeBlock(container, {
        previousBlock: previousBlock as any,
      }) as any;

      const ret = instance.getReward();

      expect(ret).to.be.deep.equal({ reward: 1500000000n });
    });
  });
  //
  describe('getSupply', () => {
    it('should return proper supply', () => {
      blocksModule.lastBlock = { height: 1 } as any;
      const ret = instance.getSupply();
      expect(ret).to.be.deep.equal({ supply: 10999999991000000n });
    });
  });
  //
  describe('getStatus', () => {
    it('should return proper data.', async () => {
      const previousBlock = createFakeBlock(container);
      previousBlock.height = 499;
      const lastBlock = createFakeBlock(container, {
        previousBlock: previousBlock as any,
      });
      blocksModule.lastBlock = lastBlock as any;

      const res = await instance.getStatus();

      expect(res).deep.eq({
        broadhash: lastBlock.id,
        epoch: new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
        fee: '10000000',
        height: 500,
        milestone: 4,
        nethash:
          'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
        reward: '1500000000',
        supply: '11000733541000000',
      });
    });
  });

  describe('getRewards', () => {
    let timeToEpoch: ITimeToEpoch;
    beforeEach(() => {
      timeToEpoch = container.get(Symbols.helpers.timeToEpoch);
    });
    it('should fail if params not ok', async () => {
      await expect(instance.getRewards({} as any)).to.rejected;
      await expect(
        instance.getRewards({ generator: 'meow' as any, from: 0, to: 1 })
      ).to.rejectedWith("Object didn't pass validation for format publicKey");

      const validPk = Buffer.alloc(32).fill('a');

      const params = {
        from: -1,
        generator: validPk.toString('hex') as any,
        to: 1,
      };
      await expect(instance.getRewards(params)).to.rejectedWith(
        'Value -1 is less than minimum'
      );

      params.from = 1;
      params.to = -1;
      await expect(instance.getRewards(params)).to.rejectedWith(
        'Value -1 is less than minimum'
      );

      params.from = 1;
      params.to = 0;
      await expect(instance.getRewards(params)).to.rejectedWith(
        'From/To params are invalid'
      );

      params.from = Math.floor(timeToEpoch.fromTimeStamp(0) / 1000) - 1000;
      params.to = params.from + 1;

      // From gets converted to `-1` in epoch timing
      await expect(instance.getRewards(params)).to.rejectedWith(
        'From/To params are invalid'
      );
    });
    it('should query BlocksModel and process result properly', async () => {
      const findAllStub = sandbox.stub(blocksModel, 'findAndCountAll');

      const params = {
        from: timeToEpoch.fromTimeStamp(10) / 1000,
        generator: Buffer.alloc(32)
          .fill(0)
          .toString('hex') as any,
        to: timeToEpoch.fromTimeStamp(100) / 1000,
      };

      findAllStub.resolves({
        count: 10,
        rows: [
          { totalFee: 10n, reward: 1n },
          { totalFee: 20n, reward: 2n },
          { totalFee: '30', reward: '3' },
          { totalFee: 40, reward: 4 },
        ],
      });

      const res = await instance.getRewards(params);

      expect(res).deep.eq({ fees: 100n, rewards: 10n, totalBlocks: 10 });

      expect(
        (findAllStub.firstCall.args[0].where as any).generatorPublicKey
      ).deep.eq(Buffer.from(params.generator, 'hex'));

      expect(
        (findAllStub.firstCall.args[0].where as any).timestamp[Op.gte]
      ).deep.eq(10);
      expect(
        (findAllStub.firstCall.args[0].where as any).timestamp[Op.lt]
      ).deep.eq(100);
    });
  });
});
