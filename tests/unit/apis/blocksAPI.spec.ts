import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BlocksAPI } from '../../../src/apis';
import { Symbols } from '../../../src/ioc/symbols';
import { BlocksModel, TransactionsModel } from '../../../src/models';
import { BlockRewardLogicStub, BlocksModuleStub, SequenceStub, SystemModuleStub, ZSchemaStub, } from '../../stubs';
import { BlockLogicStub } from '../../stubs/logic/BlockLogicStub';
import { createContainer } from '../../utils/containerCreator';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

describe('apis/blocksAPI', () => {

  let sandbox: SinonSandbox;
  let instance: BlocksAPI;
  let container: Container;
  let schema: ZSchemaStub;
  let dbSequence: SequenceStub;
  let blockRewardLogic: BlockRewardLogicStub;
  let blockLogic: BlockLogicStub;
  let blocksModule: BlocksModuleStub;
  let systemModule: SystemModuleStub;
  let constants: any;
  let fakeBlock: BlocksModel;
  let blocksModel: typeof BlocksModel;
  beforeEach(() => {
    sandbox   = sinon.createSandbox();
    container = createContainer();
    container.bind(Symbols.api.blocks).to(BlocksAPI);

    schema           = container.get(Symbols.generic.zschema);
    constants        = container.get(Symbols.helpers.constants);
    dbSequence       = container.getTagged(Symbols.helpers.sequence,
      Symbols.helpers.sequence, Symbols.tags.helpers.dbSequence);
    blockRewardLogic = container.get(Symbols.logic.blockReward);
    blockLogic       = container.get(Symbols.logic.block);
    blocksModule     = container.get(Symbols.modules.blocks);
    systemModule     = container.get(Symbols.modules.system);
    blocksModel      = container.get(Symbols.models.blocks);

    instance  = container.get(Symbols.api.blocks);
    fakeBlock = new BlocksModel({
      blockSignature    : Buffer.alloc(64).fill('a'),
      generatorPublicKey: Buffer.alloc(32).fill('b'),
      payloadHash       : Buffer.alloc(32).fill('c'),
    });

  });

  afterEach(() => {
    sandbox.restore();
  });
  //
  // describe('getBlocks', () => {
  //
  //   let listStub: SinonStub;
  //   let filters: any;
  //
  //   beforeEach(() => {
  //     filters  = {};
  //     listStub = sandbox.stub(instance as any, 'list').resolves(1);
  //   });
  //
  //   it('should call dbSequence.addAndPromise', async () => {
  //     await instance.getBlocks(filters);
  //
  //     expect(dbSequence.spies.addAndPromise.calledOnce).to.be.true;
  //   });
  //
  //   it('should call instance.list', async () => {
  //     await instance.getBlocks(filters);
  //
  //     expect(listStub.calledOnce).to.be.true;
  //     expect(listStub.firstCall.args.length).to.be.equal(1);
  //     expect(listStub.firstCall.args[0]).to.be.deep.equal(filters);
  //   });
  //
  // });

  describe('getBlocks', () => {
    let defaultFindAndCountAllParams;
    let findAllStub: SinonStub;
    beforeEach(() => {
      const TxModel                = container.get<typeof TransactionsModel>(Symbols.models.transactions);
      defaultFindAndCountAllParams = {
        // include: [TxModel],
        limit  : 100,
        offset : 0,
        order  : [['height', 'desc']],
      };
      findAllStub                  = sandbox.stub(blocksModel, 'findAndCountAll').resolves({ rows: [], count: 0 });
    });
    it('should filter by generatorPublicKey', async () => {
      await instance.getBlocks({ generatorPublicKey: 'aaaa' });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).to.be.deep.eq({
        ...defaultFindAndCountAllParams,
        where: {
          generatorPublicKey: Buffer.from('aaaa', 'hex'),
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
      await instance.getBlocks({ previousBlock: 'ahah' });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        where: { previousBlock: 'ahah' },
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
      await instance.getBlocks({ orderBy: 'id:asc' });

      delete findAllStub.firstCall.args[0].include;
      expect(findAllStub.firstCall.args[0]).be.deep.eq({
        ...defaultFindAndCountAllParams,
        order: [['id', 'asc']],
        where  : {},
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

    it('should remap object to string block type', async () => {
      findAllStub.resolves({rows: [fakeBlock, fakeBlock], count: 3});
      const stringFakeBlock = blocksModel.toStringBlockType(fakeBlock, null, null);
      const result = await instance.getBlocks({ offset: 10 });
      expect(result).to.be.deep.eq({
        blocks: [stringFakeBlock, stringFakeBlock],
        count: 3,
      });
    });
  });

  describe('getBlock', () => {

    let filters: any;
    let rows;
    let block;

    beforeEach(async () => {
      block       = {};
      rows        = [{}, {}];
      filters     = { id: 'id' };
    });

    it('should call dbSequence.addAndPromise', async () => {
      sandbox.stub(blocksModel, 'findById').resolves(fakeBlock);
      await instance.getBlock(filters);
      expect(dbSequence.spies.addAndPromise.calledOnce).to.be.true;
    });

    it('should call blocksModel.findById', async () => {
      const findByIdStub = sandbox.stub(blocksModel, 'findById').resolves(fakeBlock);
      await instance.getBlock(filters);
      expect(findByIdStub.calledOnce).is.true;
    });

    it('should throw error if rows.length === 0', async () => {
      sandbox.stub(blocksModel, 'findById').resolves(null);
      await expect(instance.getBlock(filters)).to.be.rejectedWith('Block not found');
    });

    it('should return stringified block from an id', async () => {
      sandbox.stub(blocksModel, 'findById').resolves(fakeBlock);
      const ret = await instance.getBlock(filters);

      expect(ret).to.be.deep.equal({ block: BlocksModel.toStringBlockType(fakeBlock, null, null) });
    });
  });

  describe('getHeight', () => {

    it('should return height', async () => {
      blocksModule.lastBlock = { height: 5 } as any;

      const ret = await instance.getHeight();

      expect(ret).to.be.deep.equal({ height: 5 });
    });

  });

  describe('getBroadHash', () => {

    it('should return a broadhash', async () => {
      systemModule.enqueueResponse('getBroadhash', 'hash');

      const ret = await instance.getBroadHash();

      expect(ret).to.be.deep.equal({ broadhash: 'hash' });
    });

  });

  describe('getEpoch', () => {

    it('should return an epoch', () => {
      const ret   = instance.getEpoch();
      const epoch = new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0));

      expect(ret).to.be.deep.equal({ epoch });
    });

  });

  describe('getFee', () => {

    let params;
    let fees;

    beforeEach(() => {
      fees   = {
        fees      : {
          send: 'send',
        },
        fromHeight: 'fromHeight',
        height    : 'height',
        toHeight  : 'toHeight',
      };
      params = { height: 1 };
      systemModule.enqueueResponse('getFees', fees);
    });

    it('should call systemModule.getFees', async () => {
      await instance.getFee(params);

      expect(systemModule.stubs.getFees.calledOnce).to.be.true;
      expect(systemModule.stubs.getFees.firstCall.args.length).to.be.equal(1);
      expect(systemModule.stubs.getFees.firstCall.args[0]).to.be.equal(1);
    });

    it('should return fee from height', async () => {
      const ret = await instance.getFee(params);

      expect(ret).to.be.deep.equal({
        fee       : 'send',
        fromHeight: 'fromHeight',
        height    : 'height',
        toHeight  : 'toHeight',
      });
    });

  });

  describe('getFees', () => {

    it('should call systemModule.getFees and return result', async () => {
      const retObj = {};
      const params = { height: 1 };
      systemModule.enqueueResponse('getFees', retObj);

      const ret = await instance.getFees(params);

      expect(systemModule.stubs.getFees.calledOnce).to.be.true;
      expect(systemModule.stubs.getFees.firstCall.args.length).to.be.equal(1);
      expect(systemModule.stubs.getFees.firstCall.args[0]).to.be.equal(1);

      expect(ret).to.be.deep.equal(retObj);
    });

  });

  describe('getNethash', () => {

    it('should call systemModule.getNethash and return object', () => {
      const nethash = 'nethash';
      systemModule.enqueueResponse('getNethash', nethash);

      const ret = instance.getNethash();

      expect(systemModule.stubs.getNethash.calledOnce).to.be.true;
      expect(systemModule.stubs.getNethash.firstCall.args.length).to.be.equal(0);

      expect(ret).to.be.deep.equal({ nethash });
    });

  });

  describe('getMilestone', () => {

    it('should call blockRewardLogic.calcMilestone and return object', () => {
      blocksModule.lastBlock = { height: 5 } as any;

      const ret = instance.getMilestone();

      expect(blockRewardLogic.stubs.calcMilestone.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcMilestone.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcMilestone.firstCall.args[0]).to.be.equal(5);

      expect(ret).to.be.deep.equal({ milestone: 0 });
    });

  });

  describe('getReward', () => {

    it('should call blockRewardLogic.calcReward and return object', () => {
      blocksModule.lastBlock = { height: 5 } as any;

      const ret = instance.getReward();

      expect(blockRewardLogic.stubs.calcReward.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcReward.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcReward.firstCall.args[0]).to.be.equal(5);

      expect(ret).to.be.deep.equal({ reward: 1 });
    });

  });

  describe('getSupply', () => {

    it('should call blockRewardLogic.calcSupply and return object', () => {
      blocksModule.lastBlock = { height: 5 } as any;

      const ret = instance.getSupply();

      expect(blockRewardLogic.stubs.calcSupply.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcSupply.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcSupply.firstCall.args[0]).to.be.equal(5);

      expect(ret).to.be.deep.equal({ supply: 1 });
    });

  });

  describe('getStatus', () => {

    let fee;

    beforeEach(() => {
      fee                    = { fees: { send: 'send' } };
      blocksModule.lastBlock = { height: 5 } as any;
      // systemModule.broadhash = 'broadhash';
      systemModule.enqueueResponse('getFees', fee);
      systemModule.enqueueResponse('getNethash', 1);
      systemModule.enqueueResponse('getBroadhash', 'broadhash');
    });

    it('should call systemModule.getFees', async () => {
      await instance.getStatus();

      expect(systemModule.stubs.getFees.calledOnce).to.be.true;
      expect(systemModule.stubs.getFees.firstCall.args.length).to.be.equal(1);
      expect(systemModule.stubs.getFees.firstCall.args[0]).to.be.equal(5);
    });

    it('should call blockRewardLogic.calcMilestone', async () => {
      await instance.getStatus();

      expect(blockRewardLogic.stubs.calcMilestone.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcMilestone.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcMilestone.firstCall.args[0]).to.be.equal(5);
    });

    it('should call systemModule.getNethash', async () => {
      await instance.getStatus();

      expect(systemModule.stubs.getNethash.calledOnce).to.be.true;
      expect(systemModule.stubs.getNethash.firstCall.args.length).to.be.equal(0);
    });

    it('should call blockRewardLogic.calcReward', async () => {
      await instance.getStatus();

      expect(blockRewardLogic.stubs.calcReward.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcReward.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcReward.firstCall.args[0]).to.be.equal(5);
    });

    it('should call blockRewardLogic.calcSupply', async () => {
      await instance.getStatus();

      expect(blockRewardLogic.stubs.calcSupply.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcSupply.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcSupply.firstCall.args[0]).to.be.equal(5);
    });

    it('should return a status', async () => {
      const epoch = new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0));

      const ret = await instance.getStatus();

      expect(ret).to.be.deep.equal({
        broadhash: 'broadhash',
        epoch,
        fee      : 'send',
        height   : 5,
        milestone: 0,
        nethash  : 1,
        reward   : 1,
        supply   : 1,
      });
    });
  });

});
