import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import {Op} from 'sequelize';
import { SinonSandbox, SinonStub } from 'sinon';
import { BlockProgressLogger } from '../../../../src/helpers';
import { IBlocksModuleUtils } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { RoundsLogic, SignedAndChainedBlockType } from '../../../../src/logic';
import { BlocksModuleUtils } from '../../../../src/modules/blocks/';
import { SequenceStub } from '../../../stubs';
import { BlockLogicStub } from '../../../stubs/logic/BlockLogicStub';
import TransactionLogicStub from '../../../stubs/logic/TransactionLogicStub';
import BlocksModuleStub from '../../../stubs/modules/BlocksModuleStub';
import { createContainer } from '../../../utils/containerCreator';
import { AccountsModel, BlocksModel, RoundsFeesModel } from '../../../../src/models';

// tslint:disable no-unused-expression max-line-length
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

  let genesisBlock: SignedAndChainedBlockType;

  let dbSequence: SequenceStub;

  let blockLogic: BlockLogicStub;
  let txLogic: TransactionLogicStub;

  let blocksModel: typeof BlocksModel;
  let accountsModel: typeof AccountsModel;
  let roundsFeesModel: typeof RoundsFeesModel;
  let sandbox: SinonSandbox;
  beforeEach(() => {
    blocksModule = container.get(Symbols.modules.blocks);
    genesisBlock = container.get(Symbols.generic.genesisBlock);
    dbSequence   = container.getTagged(
      Symbols.helpers.sequence,
      Symbols.helpers.sequence,
      Symbols.tags.helpers.dbSequence
    );

    blockLogic = container.get(Symbols.logic.block);
    txLogic    = container.get(Symbols.logic.transaction);

    accountsModel   = container.get(Symbols.models.accounts);
    blocksModel     = container.get(Symbols.models.blocks);
    roundsFeesModel = container.get(Symbols.models.roundsFees);
    sandbox         = sinon.createSandbox();
  });
  afterEach(() => sandbox.restore());
  describe('readDbRows', () => {
    beforeEach(() => {
      blockLogic.stubs.dbRead.callsFake((d) => ({ id: d.b_id }));
      txLogic.stubs.dbRead.callsFake((d) => {
        if (d.t_id) {
          return { id: d.t_id };
        }
        return null;
      });
    });
    it('should return array', () => {
      expect(inst.readDbRows([])).to.be.an('array');
    });
    it('should dbRead each row', () => {
      const rows = [
        { b_id: '1' },
        { b_id: '1' },
        { b_id: '1' },
      ];
      inst.readDbRows(rows as any);
      expect(blockLogic.stubs.dbRead.callCount).is.eq(3);
    });
    it('should skip txLogicdbRead null blocks', () => {
      blockLogic.stubs.dbRead.onCall(1).returns(null);
      const rows = [
        { b_id: '1' },
        { b_id: '1' },
        { b_id: '1' },
      ];
      inst.readDbRows(rows as any);
      expect(txLogic.stubs.dbRead.callCount).is.eq(2);
    });
    it('should correctly assign transactions to block not duplicating it', () => {
      blockLogic.stubs.dbRead.onCall(1).returns(null);
      const rows = [
        { b_id: '1', t_id: '2' },
        { b_id: '1' },
        { b_id: '1', t_id: '3' },
      ];
      const res  = inst.readDbRows(rows as any);
      expect(res.length).is.eq(1);
      expect(res[0].transactions.length).is.eq(2);
    });
    it('should return 2 diff blocks with correct not dups txs', () => {
      const rows = [
        { b_id: '1', t_id: '2' },
        { b_id: '1', t_id: '2' },
        { b_id: '1' },
        { b_id: '2', t_id: '3' },
      ];
      const res  = inst.readDbRows(rows as any);
      expect(res.length).is.eq(2);
      expect(res[0]).to.be.deep.eq({ id: '1', transactions: [{ id: '2' }] });
      expect(res[1]).to.be.deep.eq({ id: '2', transactions: [{ id: '3' }] });
    });
    it('should create generationSignature for block if it id is equal genesisBLock.id', async () => {
      const genBlockId = (inst as any).genesisBlock.id;
      const rows       = [
        { b_id: '1', t_id: '2' },
        { b_id: '1', t_id: '2' },
        { b_id: genBlockId },
        { b_id: '2', t_id: '3' },
      ];
      const res        = inst.readDbRows(rows as any);
      expect(res.length).is.eq(3);
      expect((res[1] as any).generationSignature).to.be.deep.eq('0000000000000000000000000000000000000000000000000000000000000000');
    });
  });

  describe('loadBlocksPart', () => {
    it('should call loadBlocksData with given filter and pass result to readDbRows', async () => {
      const loadBlocksStub = sandbox.stub(inst, 'loadBlocksData').resolves(['1', '2', '3']);

      const res = await inst.loadBlocksPart({ limit: 1, id: 'id' });
      expect(loadBlocksStub.calledOnce).is.true;

      expect(res).to.be.deep.eq(['1', '2', '3']);
    });
  });

  describe('loadLastBlock', () => {
    let findOneStub: SinonStub;
    beforeEach(() => {
      findOneStub               = sandbox.stub(blocksModel, 'findOne').resolves({});
      inst['TransactionsModel'] = 'txModel'; // useful for chai deep equality.
    });
    it('should query db', async () => {
      await inst.loadLastBlock();
      expect(findOneStub.called).is.true;
      expect(findOneStub.firstCall.args[0]).deep.eq({
        include: ['txModel'],
        order  : [['height', 'DESC']],
        limit  : 1
      });
    });
    it('should call txLogic.attachAssets over block txs', async () => {
      findOneStub.resolves({transactions: ['a','b']});
      await inst.loadLastBlock();
      expect(txLogic.stubs.attachAssets.calledOnce).is.true;
      expect(txLogic.stubs.attachAssets.firstCall.args[0]).deep.eq(['a', 'b']);
    });
    it('should set blocksModule.lastBlock to lastloadedBlock', async () => {
      findOneStub.resolves({ id: '1', transactions: [] });
      await inst.loadLastBlock();
      expect(blocksModule.lastBlock).to.be.deep.eq({ id: '1', transactions: [] });
    });
  });

  describe('getIdSequence', () => {
    let dbReturn: any;
    let findAllStub: SinonStub;
    beforeEach(() => {
      dbReturn = [{ id: '2', height: 3 }];
      container.bind('bit').to(RoundsLogic).inSingletonScope();
      const realRoundsLogic = container.get('bit');
      inst['rounds']        = realRoundsLogic;
      findAllStub           = sandbox.stub(blocksModel, 'findAll').resolves(dbReturn);
    });
    it('should query db using correct params', async () => {
      await inst.getIdSequence(2000000);
      expect(findAllStub.called).is.true;
      expect(findAllStub.firstCall.args[0]).deep.eq({
        attributes: ['id', 'height'],
        order     : [['height', 'DESC']],
        raw       : true,
        where     : {
          height: [
            1999902,
            1999801,
            1999700,
            1999599,
            1999498,
          ],
        },
      });
    });
    it('should throw error if theres no result for such height', async () => {
      findAllStub.resolves([]);
      await expect(inst.getIdSequence(10)).to.be.rejectedWith('Failed to get id sequence for height 10');
    });
    it('should prepend lastblockid', async () => {
      blocksModule.lastBlock = { id: '123', height: 50 } as any;
      const res              = await inst.getIdSequence(10);
      expect(res.ids[0]).to.be.eq('123');
    });
    it('should append genesisblock', async () => {
      const genesis: SignedAndChainedBlockType = container.get(Symbols.generic.genesisBlock);
      blocksModule.lastBlock                   = { id: '123', height: 50 } as any;
      const res                                = await inst.getIdSequence(10);
      expect(res.ids[2]).to.be.eq(genesis.id);
    });

    it('should not prepend twice lastblockid if already from sql', async () => {
      const genesis: SignedAndChainedBlockType = container.get(Symbols.generic.genesisBlock);
      blocksModule.lastBlock                   = { id: '123', height: 50 } as any;
      dbReturn.push(blocksModule.lastBlock);
      const res = await inst.getIdSequence(10);
      expect(res.ids).to.be.deep.eq(['2', '123', genesis.id]);
    });
    it('should not append genesis if already from sql', async () => {
      const genesis: SignedAndChainedBlockType = container.get(Symbols.generic.genesisBlock);
      blocksModule.lastBlock                   = { id: '123', height: 50 } as any;
      dbReturn.push(genesisBlock);
      const res = await inst.getIdSequence(10);
      expect(res.ids).to.be.deep.eq(['123', '2', genesis.id]);
    });
  });
  describe('loadBlocksData', () => {
    let findOneStub: SinonStub;
    let findAllStub: SinonStub;
    beforeEach(() => {
      findOneStub = sandbox.stub(blocksModel, 'findOne').resolves({height: 10});
      findAllStub = sandbox.stub(blocksModel, 'findAll').resolves([{height: 11}, {height: 12}]);
      inst['TransactionsModel'] = 'txModel';
    });
    it('should disallow passing both id and lastId', async () => {
      await expect(inst.loadBlocksData({ id: '1', lastId: '2' }))
        .to.be.rejectedWith('Invalid filter');
    });
    it('should wrap queries within dbSequence', async () => {
      await inst.loadBlocksData({ id: '1' });
      expect(dbSequence.spies.addAndPromise.called).is.true;
      expect(dbSequence.spies.addAndPromise.calledBefore(
        findOneStub
      )).is.true;
      expect(dbSequence.spies.addAndPromise.calledBefore(
        findAllStub
      )).is.true;
    });
    it('should query height by id.', async () => {
      await inst.loadBlocksData({ id: '1' });
      expect(findOneStub.firstCall.args[0]).to.be.deep.eq({
        include: [ 'txModel' ],
        where: { id: '1' },
      });
    });
    it('should query db correctly based on input and height output', async () => {
      await inst.loadBlocksData({ lastId: '1', limit: 2 });
      expect(findAllStub.firstCall.args[0]).to.be.deep.eq({
        include: [ 'txModel' ],
        order: ['height', 'rowId'],
        where: { height: {[Op.gt]: 10, [Op.lt]: 10 + 2 } },
      });
      expect(findAllStub.firstCall.args[0].where.height[Op.gt]).eq(10);
      expect(findAllStub.firstCall.args[0].where.height[Op.lt]).eq(10 + 2);
    });
    it('should remap error to Blocks#loadBlockData error', async () => {
      findAllStub.rejects(new Error('meow'));
      await expect(inst.loadBlocksData({ lastId: '1' })).to.be.rejectedWith('Blocks#loadBlockData error');
    });
  });

  describe('getBlockProgressLogger', () => {
    it('should return BlockProgresslogger with given arguments', async () => {
      const res = inst.getBlockProgressLogger(10, 5, 'msg');
      expect(res).to.be.instanceOf(BlockProgressLogger);
      // tslint:disable no-string-literal
      expect(res['target']).is.eq(10);
      expect(res['step']).is.eq(2);
    });
  });

  describe('aggregateBlockReward', () => {
    let findOneStub: SinonStub;
    let aggregateFeesStub: SinonStub;
    let findAccountStub: SinonStub;
    beforeEach(() => {
      findOneStub = sandbox.stub(blocksModel, 'findOne').resolves({count: 1, rewards: 3});
      aggregateFeesStub = sandbox.stub(roundsFeesModel, 'aggregate').resolves(2);
      findAccountStub = sandbox.stub(accountsModel, 'findOne').resolves({acc: 'acc'})
    });
    it('should allow specify start time in unix timestamp', async () => {
      const constants = container.get<any>(Symbols.helpers.constants);
      await inst.aggregateBlockReward({
        generatorPublicKey: 'aabb',
        start             : Math.floor(constants.epochTime.getTime() / 1000 + 1000),
      });
      expect(findOneStub.called).is.true;
      expect(findOneStub.firstCall.args[0]).to.be.deep.eq({
        attributes: [ {val: 'COUNT(1)'}, {val: 'SUM("reward") as rewards' }],
        raw: true,
        where: {
          generatorPublicKey: Buffer.from('aabb', 'hex'),
          timestamp: { [Op.gte]: 1000},
        },
      });
      expect(findOneStub.firstCall.args[0].where.timestamp[Op.gte]).eq(1000);
    });
    it('should allow specify end time in unix timestamp', async () => {
      const constants = container.get<any>(Symbols.helpers.constants);
      await inst.aggregateBlockReward({
        end               : Math.floor(constants.epochTime.getTime() / 1000 + 1000),
        generatorPublicKey: 'aabb',
      });
      expect(findOneStub.called).is.true;
      expect(findOneStub.firstCall.args[0]).to.be.deep.eq({
        attributes: [ {val: 'COUNT(1)'}, {val: 'SUM("reward") as rewards' }],
        raw: true,
        where: {
          generatorPublicKey: Buffer.from('aabb', 'hex'),
          timestamp: { [Op.lte]: 1000},
        },
      });
      expect(findOneStub.firstCall.args[0].where.timestamp[Op.lte]).eq(1000);
    });
    it('should issue db query and use that as result', async () => {
      const res = await inst.aggregateBlockReward({
        generatorPublicKey: 'abc',
      });

      expect(res).to.be.deep.eq({
        count  : 1, // defaulted to zero
        fees   : 2,
        rewards: 3,
      });
    });
    it('should throw error if returned data shows delegate does not exist', async () => {
      findAccountStub.resolves(null);
      await expect(inst.aggregateBlockReward({ generatorPublicKey: 'abc' }))
        .to.be.rejectedWith('Account not found or is not a delegate');
    });
  });

});
