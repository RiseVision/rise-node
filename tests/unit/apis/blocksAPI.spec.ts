import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { BlocksAPI } from '../../../src/apis/blocksAPI';
import { OrderBy } from '../../../src/helpers';
import * as helpers from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import sql from '../../../src/sql/blocks';
import {
  BlockRewardLogicStub, BlocksModuleStub, DbStub, SequenceStub, SystemModuleStub, ZSchemaStub,
} from '../../stubs';
import { BlockLogicStub } from '../../stubs/logic/BlockLogicStub';
import { createContainer } from '../../utils/containerCreator';

chai.use(chaiAsPromised);

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
    container.bind(Symbols.api.blocks).to(BlocksAPI);

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
      blocksModule.lastBlock = { height: 5 } as any;

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

    let OrderBySpy: SinonSpy;
    let countListSpy: SinonSpy;
    let listSpy: SinonSpy;
    let blockRows;
    let filter;

    beforeEach(() => {
      filter    = {};
      blockRows = ['row1', 'row2'];

      instance      = instance as any;
      OrderBySpy    = sandbox.spy(helpers, 'OrderBy');
      countListSpy  = sandbox.spy(sql, 'countList');
      listSpy       = sandbox.spy(sql, 'list');

      db.enqueueResponse('query', Promise.resolve([{ count: 10 }]));
      db.enqueueResponse('query', Promise.resolve(blockRows));
      blockLogic.stubs.dbRead.callsFake((row) => row);
    });

    describe('filter validation', () => {

      let params;
      let where;

      // Helper function to catch the where and params variables
      const doCall = async (fltr) => {
        params = null;
        where  = null;
        await instance['list'](fltr);
        if (db.stubs.query.called) {
          params = db.stubs.query.firstCall.args[1];
        }
        if (countListSpy.called) {
          where = countListSpy.firstCall.args[0].where;
        }
      };

      it('generatorPublicKey state is exist', async () => {
        filter.generatorPublicKey = 'generatorPublicKey';

        await doCall(filter);

        expect(where[0]).to.be.equal('"b_generatorPublicKey"::bytea = ${generatorPublicKey}');
        expect(params.generatorPublicKey).to.be.equal('generatorPublicKey');
      });

      it('numberOfTransactions state is exist', async () => {
        filter.numberOfTransactions = 'numberOfTransactions';

        await doCall(filter);

        expect(where[0]).to.be.equal('"b_numberOfTransactions" = ${numberOfTransactions}');
        expect(params.numberOfTransactions).to.be.equal('numberOfTransactions');
      });

      it('previousBlock state is exist', async () => {
        filter.previousBlock = 'previousBlock';

        await doCall(filter);

        expect(where[0]).to.be.equal('"b_previousBlock" = ${previousBlock}');
        expect(params.previousBlock).to.be.equal('previousBlock');
      });

      it('height === 0', async () => {
        filter.height = 0;

        await doCall(filter);

        expect(where[0]).to.be.equal('"b_height" = ${height}');
        expect(params.height).to.be.equal(0);
      });

      it('height > 0', async () => {
        filter.height = 1;

        await doCall(filter);

        expect(where[0]).to.be.equal('"b_height" = ${height}');
        expect(params.height).to.be.equal(1);
      });

      it('totalAmount >= 0', async () => {
        filter.totalAmount = 5;

        await doCall(filter);

        expect(where[0]).to.be.equal('"b_totalAmount" = ${totalAmount}');
        expect(params.totalAmount).to.be.equal(5);
      });

      it('totalFee >= 0', async () => {
        filter.totalFee = 5;

        await doCall(filter);

        expect(where[0]).to.be.equal('"b_totalFee" = ${totalFee}');
        expect(params.totalFee).to.be.equal(5);
      });

      it('reward >= 0', async () => {
        filter.reward = 5;

        await doCall(filter);

        expect(where[0]).to.be.equal('"b_reward" = ${reward}');
        expect(params.reward).to.be.equal(5);
      });

      it('limit state is exist', async () => {
        filter.limit = -10;

        await doCall(filter);

        expect(params.limit).to.be.equal(10);
      });

      it('limit state isn"t exist', async () => {
        await doCall(filter);

        expect(params.limit).to.be.equal(100);
      });

      it('should throw error if limit is biggest than 100', async () => {
        filter.limit = 101;

        await expect(doCall(filter)).to.be.rejectedWith('Invalid limit. Maximum is 100');
      });

      it('offset state is exist', async () => {
        filter.offset = -10;

        await doCall(filter);

        expect(params.offset).to.be.equal(10);
      });

      it('offset state isn"t exist', async () => {
        await doCall(filter);

        expect(params.offset).to.be.equal(0);
      });

    });

    describe('OrderBy', async () => {

      it('should call OrderBy', async () => {
        await instance['list'](filter);

        expect(OrderBySpy.calledOnce).to.be.true;
        expect(OrderBySpy.firstCall.args.length).to.be.equal(2);
        expect(OrderBySpy.firstCall.args[0]).to.be.equal('height:desc');
        expect(OrderBySpy.firstCall.args[1]).to.be.deep.equal({
          fieldPrefix: 'b_',
          quoteField : true,
          sortField  : null,
          sortFields : [
            'id',
            'timestamp',
            'height',
            'previousBlock',
            'totalAmount',
            'totalFee',
            'reward',
            'numberOfTransactions',
            'generatorPublicKey',
          ],
          sortMethod : null,
        });
      });

      it('check if filter.orderBy is exist', async () => {
        filter.orderBy = 'height';

        await instance['list'](filter);

        expect(OrderBySpy.calledOnce).to.be.true;
        expect(OrderBySpy.firstCall.args.length).to.be.equal(2);
        expect(OrderBySpy.firstCall.args[0]).to.be.equal('height');
      });

      it('should throw error if OrderBy retuns error state', async () => {
        filter.orderBy = 'MDAAAAVOTENTOPASHALKA';

        await expect(instance['list'](filter)).to.be.rejectedWith(OrderBySpy.firstCall.returnValue.error);
      });

    });

    it('should call db.query twice', async () => {
      await instance['list'](filter);

      expect(db.stubs.query.calledTwice).to.be.true;

      expect(db.stubs.query.firstCall.args.length).to.be.equal(2);
      expect(db.stubs.query.firstCall.args[0]).to.be.equal('SELECT COALESCE((SELECT height FROM blocks ORDER BY height DESC LIMIT 1), 0)');
      expect(db.stubs.query.firstCall.args[1]).to.be.deep.equal({
        limit : 100,
        offset: 0,
      });

      expect(db.stubs.query.secondCall.args.length).to.be.equal(2);
      expect(db.stubs.query.secondCall.args[0]).to.be.equal('SELECT * FROM blocks_list ORDER BY "b_height" DESC LIMIT ${limit} OFFSET ${offset}');
      expect(db.stubs.query.secondCall.args[1]).to.be.deep.equal({
        limit : 100,
        offset: 0,
      });
    });

    it('should call sql.countList', async () => {
      await instance['list'](filter);

      expect(countListSpy.calledOnce).to.be.true;
      expect(countListSpy.firstCall.args.length).to.be.equal(1);
      expect(countListSpy.firstCall.args[0]).to.be.deep.equal({
        where: [],
      });
    });

    it('should call sql.list', async () => {
      await instance['list'](filter);

      expect(db.stubs.query.calledTwice).to.be.true;

      expect(listSpy.calledOnce).to.be.true;
      expect(listSpy.firstCall.args.length).to.be.equal(1);
      expect(listSpy.firstCall.args[0]).to.be.deep.equal({
        sortField : '\"b_height"',
        sortMethod: 'DESC',
        where     : [],
      });
    });

    it('should call blockLogic.dbRead for each row', async () => {
      await instance['list'](filter);

      expect(blockLogic.stubs.dbRead.calledTwice).to.be.true;

      expect(blockLogic.stubs.dbRead.firstCall.args.length).to.be.equal(1);
      expect(blockLogic.stubs.dbRead.firstCall.args[0]).to.be.equal(blockRows[0]);

      expect(blockLogic.stubs.dbRead.secondCall.args.length).to.be.equal(1);
      expect(blockLogic.stubs.dbRead.secondCall.args[0]).to.be.equal(blockRows[1]);
    });

    it('success', async () => {
      const ret = await instance['list'](filter);

      expect(ret).to.be.deep.equal({ blocks: blockRows, count: 10 });
    });
  });

});
