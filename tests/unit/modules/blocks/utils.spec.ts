import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { IBlocksModuleUtils } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { BlocksModuleUtils } from '../../../../src/modules/blocks/';
import { createContainer } from '../../../utils/containerCreator';
import DbStub from '../../../stubs/helpers/DbStub';
import { SequenceStub } from '../../../stubs/helpers/SequenceStub';
import BlocksModuleStub from '../../../stubs/modules/BlocksModuleStub';
import { SignedAndChainedBlockType } from '../../../../src/logic';
import { BlockLogicStub } from '../../../stubs/logic/BlockLogicStub';
import TransactionLogicStub from '../../../stubs/logic/TransactionLogicStub';
import { BlockProgressLogger } from '../../../../src/helpers';
import { SinonStub } from 'sinon';

chai.use(chaiAsPromised);
describe('modules/utils', () => {
  let inst: IBlocksModuleUtils;
  let container: Container;
  beforeEach(() => {
    container = createContainer();
    container.rebind(Symbols.modules.blocksSubModules.utils).to(BlocksModuleUtils);

    inst = container.get(Symbols.modules.blocksSubModules.utils);
  });

  let blocksModule: BlocksModuleStub;

  let dbStub: DbStub;
  let genesisBlock: SignedAndChainedBlockType;

  let dbSequence: SequenceStub;

  let blockLogic: BlockLogicStub;
  let txLogic: TransactionLogicStub;
  beforeEach(() => {
    blocksModule = container.get(Symbols.modules.blocks);

    dbStub       = container.get(Symbols.generic.db);
    genesisBlock = container.get(Symbols.generic.genesisBlock);

    dbSequence = container.getTagged(
      Symbols.helpers.sequence,
      Symbols.helpers.sequence,
      Symbols.tags.helpers.dbSequence
    );

    blockLogic = container.get(Symbols.logic.block);
    txLogic    = container.get(Symbols.logic.transaction);
  });
  describe('readDbRows', () => {
    beforeEach(() => {
      blockLogic.stubs.dbRead.callsFake((d) => ({id: d.b_id}));
      txLogic.stubs.dbRead.callsFake((d) => {
        if (d.t_id) {
          return {id: d.t_id};
        }
        return null;
      });
    });
    it('should return array', () => {
      expect(inst.readDbRows([])).to.be.an('array');
    });
    it('should dbRead each row', () => {
      const rows = [
        {b_id: '1'},
        {b_id: '1'},
        {b_id: '1'},
      ];
      inst.readDbRows(rows as any);
      expect(blockLogic.stubs.dbRead.callCount).is.eq(3);
    });
    it('should skip txLogicdbRead null blocks', () => {
      blockLogic.stubs.dbRead.onCall(1).returns(null);
      const rows = [
        {b_id: '1'},
        {b_id: '1'},
        {b_id: '1'},
      ];
      inst.readDbRows(rows as any);
      expect(txLogic.stubs.dbRead.callCount).is.eq(2);
    });
    it('should correctly assign transactions to block not duplicating it', () => {
      blockLogic.stubs.dbRead.onCall(1).returns(null);
      const rows = [
        {b_id: '1', t_id: '2'},
        {b_id: '1'},
        {b_id: '1', t_id: '3'},
      ];
      const res  = inst.readDbRows(rows as any);
      expect(res.length).is.eq(1);
      expect(res[0].transactions.length).is.eq(2);
    });
    it('should return 2 diff blocks with correct not dups txs', () => {
      const rows = [
        {b_id: '1', t_id: '2'},
        {b_id: '1', t_id: '2'},
        {b_id: '1'},
        {b_id: '2', t_id: '3'},
      ];
      const res  = inst.readDbRows(rows as any);
      expect(res.length).is.eq(2);
      expect(res[0]).to.be.deep.eq({id: '1', transactions: [{id: '2'}]});
      expect(res[1]).to.be.deep.eq({id: '2', transactions: [{id: '3'}]});
    });
  });

  describe('loadBlocksPart', () => {
    it('should call loadBlocksData with given filter and pass result to readDbRows', async () => {
      const loadBlocksStub = sinon.stub(inst, 'loadBlocksData').resolves(['1', '2', '3']);
      const readDbRowsStub = sinon.stub(inst, 'readDbRows').resolves(['a', 'b', 'c']);

      const res = await inst.loadBlocksPart({limit: 1, id: 'id'});
      expect(loadBlocksStub.calledOnce).is.true;
      expect(readDbRowsStub.calledOnce).is.true;

      expect(loadBlocksStub.firstCall.args[0]).to.be.deep.eq({limit: 1, id: 'id'});
      expect(readDbRowsStub.firstCall.args[0]).to.be.deep.eq(['1', '2', '3']);
      expect(res).to.be.deep.eq(['a', 'b', 'c']);
    });
  });

  describe('loadLastBlock', () => {
    let readDbRowsStub: SinonStub;
    beforeEach(() => {
      dbStub.stubs.query.resolves([]);
      readDbRowsStub = sinon.stub(inst, 'readDbRows').returns([{id: '1', transactions: []}]);
    });
    it('should query db', async () => {
      await inst.loadLastBlock();
      expect(dbStub.stubs.query.called).is.true;
    });
    it('should call readDbRows with sql result', async () => {
      dbStub.stubs.query.resolves(['1', '2', '3']);
      await inst.loadLastBlock();
      expect(readDbRowsStub.called).is.true;
      expect(readDbRowsStub.firstCall.args[0]).is.deep.eq(['1', '2', '3']);
    });

    it('should set blocksModule.lastBlock to lastloadedBlock', async () => {
      await inst.loadLastBlock();
      expect(blocksModule.lastBlock).to.be.deep.eq({id: '1', transactions: []});
    });

    it('should remap error if something happend', async () => {
      dbStub.stubs.query.rejects(new Error('meow'));
      await expect(inst.loadLastBlock()).to.be.rejectedWith('Blocks#loadLastBlock error');
    });
  });

  describe('getIdSequence', () => {
    let dbReturn: any;
    beforeEach(() => {
      dbReturn = [{id: '2', height: 3}];
      dbStub.stubs.query.callsFake(() => Promise.resolve(dbReturn));
    });
    it('should query db using correct params', async () => {
      const constants = container.get<any>(Symbols.helpers.constants);
      await inst.getIdSequence(10);
      expect(dbStub.stubs.query.called).is.true;
      expect(dbStub.stubs.query.firstCall.args[1]).is.deep.eq({
        delegates: constants.activeDelegates,
        height   : 10,
        limit    : 5,
      });
    });
    it('should throw error if theres no result for such height', async () => {
      dbStub.stubs.query.resolves([]);
      await expect(inst.getIdSequence(10)).to.be.rejectedWith('Failed to get id sequence for height 10');
    });
    it('should prepend lastblockid', async () => {
      blocksModule.lastBlock = {id: '123', height: 50} as any;
      const res              = await inst.getIdSequence(10);
      expect(res.ids[0]).to.be.eq('123');
    });
    it('should append genesisblock', async () => {
      const genesis: SignedAndChainedBlockType = container.get(Symbols.generic.genesisBlock);
      blocksModule.lastBlock                   = {id: '123', height: 50} as any;
      const res                                = await inst.getIdSequence(10);
      expect(res.ids[2]).to.be.eq(genesis.id);
    });

    it('should not prepend twice lastblockid if already from sql', async () => {
      const genesis: SignedAndChainedBlockType = container.get(Symbols.generic.genesisBlock);
      blocksModule.lastBlock                   = {id: '123', height: 50} as any;
      dbReturn.push(blocksModule.lastBlock);
      const res = await inst.getIdSequence(10);
      expect(res.ids).to.be.deep.eq(['2', '123', genesis.id]);
    });
    it('should not append genesis if already from sql', async () => {
      const genesis: SignedAndChainedBlockType = container.get(Symbols.generic.genesisBlock);
      blocksModule.lastBlock                   = {id: '123', height: 50} as any;
      dbReturn.push(genesisBlock);
      const res = await inst.getIdSequence(10);
      expect(res.ids).to.be.deep.eq(['123', '2', genesis.id]);
    });
  });
  describe('loadBlocksData', () => {
    beforeEach(() => {
      dbStub.stubs.oneOrNone.resolves({height: 10});
      dbStub.stubs.query.resolves([{raw: 'fullblocklist'}]);
    });
    it('should disallow passing both id and lastId', async () => {
      await expect(inst.loadBlocksData({id: '1', lastId: '2'}))
        .to.be.rejectedWith('Invalid filter');
    });
    it('should wrap queries within dbSequence', async () => {
      await inst.loadBlocksData({id: '1'});
      expect(dbSequence.spies.addAndPromise.called).is.true;
      expect(dbSequence.spies.addAndPromise.calledBefore(
        dbStub.stubs.oneOrNone
      )).is.true;
      expect(dbSequence.spies.addAndPromise.calledBefore(
        dbStub.stubs.query
      )).is.true;
    });
    it('should query height by id.', async () => {
      await inst.loadBlocksData({id: '1'});
      expect(dbStub.stubs.oneOrNone.firstCall.args[1]).to.be.deep.eq({
        lastId: '1',
      });
    });
    it('should query db correctly based on input and height output', async () => {
      await inst.loadBlocksData({lastId: '1', limit: 2});
      expect(dbStub.stubs.query.firstCall.args[1]).to.be.deep.eq({
        height: 10,
        lastId: '1',
        limit : 10 + 2,
      });
    });
    it('should remap error to Blocks#loadBlockData error', async () => {
      dbStub.stubs.query.rejects(new Error('meow'));
      await expect(inst.loadBlocksData({lastId: '1'})).to.be.rejectedWith('Blocks#loadBlockData error');
    });
  });

  describe('getBlockProgressLogger', () => {
    it('should return BlockProgresslogger with given arguments', async () => {
      const res = inst.getBlockProgressLogger(10, 5, 'msg');
      expect(res).to.be.instanceOf(BlockProgressLogger);
      expect(res['target']).is.eq(10);
      expect(res['step']).is.eq(2);
    });
  });

  describe('aggregateBlockReward', () => {
    beforeEach(() => {
      dbStub.enqueueResponse('oneOrNone', Promise.resolve({
        delegate: 1,
        fees    : 2,
        rewards : 3,
      }));
    });
    it('should allow specify start time in unix timestamp', async () => {
      const constants = container.get<any>(Symbols.helpers.constants);
      await inst.aggregateBlockReward({
        generatorPublicKey: 'abc',
        start             : Math.floor(constants.epochTime.getTime() / 1000 + 1000)
      });
      expect(dbStub.stubs.oneOrNone.called).is.true;
      expect(await dbStub.stubs.oneOrNone.firstCall.args[1]).is.deep.eq({
        delegates         : constants.activeDelegates,
        generatorPublicKey: 'abc',
        start             : 1000,
      });
    });
    it('should allow specify end time in unix timestamp', async () => {
      const constants = container.get<any>(Symbols.helpers.constants);
      await inst.aggregateBlockReward({
        generatorPublicKey: 'abc',
        end               : Math.floor(constants.epochTime.getTime() / 1000 + 1000)
      });
      expect(dbStub.stubs.oneOrNone.called).is.true;
      expect(await dbStub.stubs.oneOrNone.firstCall.args[1]).is.deep.eq({
        delegates         : constants.activeDelegates,
        end               : 1000,
        generatorPublicKey: 'abc',
      });
    });
    it('should issue db query and use that as result', async () => {
      const res = await inst.aggregateBlockReward({
        generatorPublicKey: 'abc',
      });

      expect(res).to.be.deep.eq({
        fees   : 2,
        rewards: 3,
        count  : 0, // defaulted to zero
      });
    });
    it('should throw error if returned data shows delegate does not exist', async () => {
      dbStub.reset();
      dbStub.enqueueResponse('oneOrNone', Promise.resolve({delegate: null}));
      await expect(inst.aggregateBlockReward({generatorPublicKey: 'abc'}))
        .to.be.rejectedWith('Account not found or is not a delegate');
    });
  });

});
