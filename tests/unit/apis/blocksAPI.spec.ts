import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { BlocksAPI } from '../../../src/apis/blocksAPI';
import { Symbols } from '../../../src/ioc/symbols';
import * as rewire from 'rewire';
import {
  BlockRewardLogicStub, BlocksModuleStub, DbStub, SequenceStub, SystemModuleStub, ZSchemaStub,
} from '../../stubs';
import { BlockLogicStub } from '../../stubs/logic/BlockLogicStub';
import { createContainer } from '../../utils/containerCreator';

chai.use(chaiAsPromised);

const BlocksAPIRewire = rewire('../../../src/apis/blocksAPI');

// tslint:disable no-unused-expression max-line-length

describe('apis/blocksAPI', () => {

  let sandbox: SinonSandbox;
  let instance: BlocksAPI;
  let container: Container;
  let schema: ZSchemaStub;
  let db: DbStub;
  let dbSequence: SequenceStub;
  let blockRewardLogic: BlockRewardLogicStub;
  let blockLogic: BlockLogicStub;
  let blocksModule: BlocksModuleStub;
  let systemModule: SystemModuleStub;
  let constants: any;

  beforeEach(() => {
    sandbox   = sinon.sandbox.create();
    container = createContainer();
    container.bind(Symbols.api.blocks).to(BlocksAPIRewire.BlocksAPI);

    schema           = container.get(Symbols.generic.zschema);
    db               = container.get(Symbols.generic.db);
    constants        = container.get(Symbols.helpers.constants);
    dbSequence       = container.getTagged(Symbols.helpers.sequence,
      Symbols.helpers.sequence, Symbols.tags.helpers.dbSequence);
    blockRewardLogic = container.get(Symbols.logic.blockReward);
    blockLogic       = container.get(Symbols.logic.block);
    blocksModule     = container.get(Symbols.modules.blocks);
    systemModule     = container.get(Symbols.modules.system);

    instance = container.get(Symbols.api.blocks);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getBlocks', () => {

    let listStub: SinonStub;
    let filters: any;

    beforeEach(() => {
      filters  = {};
      listStub = sandbox.stub(instance as any, 'list').resolves(1);
    });

    it('should call dbSequence.addAndPromise', async () => {
      await instance.getBlocks(filters);

      expect(dbSequence.spies.addAndPromise.calledOnce).to.be.true;
      expect(dbSequence.spies.addAndPromise.calledBefore(listStub)).to.be.true;
    });

    it('should call instance.list', async () => {
      await instance.getBlocks(filters);

      expect(listStub.calledOnce).to.be.true;
      expect(listStub.firstCall.args.length).to.be.equal(1);
      expect(listStub.firstCall.args[0]).to.be.deep.equal(filters);
    });

  });

  describe('getBlock', () => {

    let filters: any;
    let rows;
    let block;

    beforeEach(() => {
      block   = {};
      rows    = [{}, {}];
      filters = { id: 'id' };
      db.enqueueResponse('query', Promise.resolve(rows));
      blockLogic.enqueueResponse('dbRead', block);
    });

    it('should call dbSequence.addAndPromise', async () => {
      await instance.getBlock(filters);

      expect(dbSequence.spies.addAndPromise.calledOnce).to.be.true;
      expect(dbSequence.spies.addAndPromise.calledBefore(db.stubs.query)).to.be.true;
    });

    it('should call db.query', async () => {
      await instance.getBlock(filters);

      expect(db.stubs.query.calledOnce).to.be.true;
      expect(db.stubs.query.firstCall.args.length).to.be.equal(2);
      expect(db.stubs.query.firstCall.args[0]).to.be.equal('SELECT * FROM blocks_list WHERE "b_id" = ${id}');
      expect(db.stubs.query.firstCall.args[1]).to.be.deep.equal({ id: 'id' });
    });

    it('should throw error if rows.length === 0', async () => {
      db.reset();
      db.enqueueResponse('query', Promise.resolve([]));

      await expect(instance.getBlock(filters)).to.be.rejectedWith('Block not found');
    });

    it('should call db.dbRead', async () => {
      await instance.getBlock(filters);

      expect(blockLogic.stubs.dbRead.calledOnce).to.be.true;
      expect(blockLogic.stubs.dbRead.firstCall.args.length).to.be.equal(1);
      expect(blockLogic.stubs.dbRead.firstCall.args[0]).to.be.deep.equal({});
    });

    it('success', async () => {
      const ret = await instance.getBlock(filters);

      expect(ret).to.be.deep.equal({ block });
    });
  });

  describe('getHeight', () => {

    it('success', async () => {
      blocksModule.lastBlock = { height: 5 };

      const ret = await instance.getHeight();

      expect(ret).to.be.deep.equal({ height: 5 });
    });

  });

  describe('getBroadHash', () => {

    it('success', async () => {
      systemModule.enqueueResponse('getBroadhash', 'hash');

      const ret = await instance.getBroadHash();

      expect(ret).to.be.deep.equal({ broadhash: 'hash' });
    });

  });

  describe('getEpoch', () => {

    it('success', () => {
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
        fromHeight: 'fromHeight',
        toHeight  : 'toHeight',
        height    : 'height',
        fees      : {
          send: 'send',
        },
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

    it('success', async () => {
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
      blocksModule.lastBlock = { height: 5 };

      const ret = instance.getMilestone();

      expect(blockRewardLogic.stubs.calcMilestone.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcMilestone.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcMilestone.firstCall.args[0]).to.be.equal(5);

      expect(ret).to.be.deep.equal({ milestone: 0 });
    });

  });

  describe('getReward', () => {

    it('should call blockRewardLogic.calcReward and return object', () => {
      blocksModule.lastBlock = { height: 5 };

      const ret = instance.getReward();

      expect(blockRewardLogic.stubs.calcReward.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcReward.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcReward.firstCall.args[0]).to.be.equal(5);

      expect(ret).to.be.deep.equal({ reward: 1 });
    });

  });

  describe('getSupply', () => {

    it('should call blockRewardLogic.calcSupply and return object', () => {
      blocksModule.lastBlock = { height: 5 };

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
      blocksModule.lastBlock = { height: 5 };
      systemModule.broadhash = 'broadhash';
      systemModule.enqueueResponse('getFees', fee);
      systemModule.enqueueResponse('getNethash', 1);
    });

    it('should call systemModule.getFees', () => {
      instance.getStatus();

      expect(systemModule.stubs.getFees.calledOnce).to.be.true;
      expect(systemModule.stubs.getFees.firstCall.args.length).to.be.equal(1);
      expect(systemModule.stubs.getFees.firstCall.args[0]).to.be.equal(5);
    });

    it('should call blockRewardLogic.calcMilestone', () => {
      instance.getStatus();

      expect(blockRewardLogic.stubs.calcMilestone.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcMilestone.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcMilestone.firstCall.args[0]).to.be.equal(5);
    });

    it('should call systemModule.getNethash', () => {
      instance.getStatus();

      expect(systemModule.stubs.getNethash.calledOnce).to.be.true;
      expect(systemModule.stubs.getNethash.firstCall.args.length).to.be.equal(0);
    });

    it('should call blockRewardLogic.calcReward', () => {
      instance.getStatus();

      expect(blockRewardLogic.stubs.calcReward.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcReward.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcReward.firstCall.args[0]).to.be.equal(5);
    });

    it('should call blockRewardLogic.calcSupply', () => {
      instance.getStatus();

      expect(blockRewardLogic.stubs.calcSupply.calledOnce).to.be.true;
      expect(blockRewardLogic.stubs.calcSupply.firstCall.args.length).to.be.equal(1);
      expect(blockRewardLogic.stubs.calcSupply.firstCall.args[0]).to.be.equal(5);
    });

    it('success', () => {
      const epoch = new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0));

      const ret = instance.getStatus();

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

  describe('list', () => {
  });

});
