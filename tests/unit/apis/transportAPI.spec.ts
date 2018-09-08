import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { Op } from 'sequelize';
import { TransportAPI } from '../../../src/apis';
import { Symbols } from '../../../src/ioc/symbols';
import {
  BlocksModuleStub,
  BlocksSubmoduleUtilsStub,
  BusStub,
  PeersLogicStub,
  PeersModuleStub,
  TransactionsModuleStub,
  TransportModuleStub
} from '../../stubs';
import { BlockLogicStub } from '../../stubs/logic/BlockLogicStub';
import { createFakeBlock } from '../../utils/blockCrafter';
import { createContainer } from '../../utils/containerCreator';
import { createRandomTransactions, toBufferedTransaction } from '../../utils/txCrafter';
import { BlocksModel, TransactionsModel } from '../../../src/models';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/transportAPI', () => {
  let sandbox: SinonSandbox;
  let instance: TransportAPI;
  let container: Container;
  let result: any;
  let fakeBlock: any;
  let blocksModule: BlocksModuleStub;
  let peersLogicStub: PeersLogicStub;
  let peersModuleStub: PeersModuleStub;
  let transactionsModuleStub: TransactionsModuleStub;
  let txs: any;
  let transportModuleStub: TransportModuleStub;
  let thePeer: any;
  let blockLogicStub: BlockLogicStub;
  let busStub: BusStub;
  let blocksSubmoduleUtilsStub: BlocksSubmoduleUtilsStub;
  let blocksModel: typeof BlocksModel;
  let transactionsModel: typeof TransactionsModel;
  beforeEach(() => {
    container         = createContainer();
    const constants   = container.get<any>(Symbols.helpers.constants);
    blocksModel       = container.get(Symbols.models.blocks);
    transactionsModel = container.get(Symbols.models.transactions);
    peersModuleStub   = container.get(Symbols.modules.peers);
    const fakePeers = ['a', 'b', 'c'].map((p) => { return {object: () => {return p}}});
    peersModuleStub.enqueueResponse('list', {
      consensus: 123,
      peers    : fakePeers,
    });
    peersModuleStub.enqueueResponse('remove', true);
    transactionsModuleStub = container.get(Symbols.modules.transactions);
    transactionsModuleStub.enqueueResponse('getMultisignatureTransactionList', [
      { id: '100', signatures: [1, 2, 3] },
      { id: '101', signatures: [] },
      { id: '102', signatures: [1, 2, 3] },
    ]);
    transactionsModuleStub.enqueueResponse('getMergedTransactionList', [
      { id: 10 },
      { id: 11 },
      { id: 12 },
    ]);
    transportModuleStub = container.get(Symbols.modules.transport);
    transportModuleStub.enqueueResponse('receiveTransactions', true);
    transportModuleStub.enqueueResponse('receiveSignatures', Promise.resolve());
    peersLogicStub = container.get(Symbols.logic.peers);
    thePeer        = { ip: '8.8.8.8', port: 1234 };
    peersLogicStub.enqueueResponse('create', thePeer);
    container.bind(Symbols.api.transport).to(TransportAPI);
    blockLogicStub = container.get(Symbols.logic.block);
    busStub        = container.get(Symbols.helpers.bus);
    busStub.enqueueResponse('message', true);
    blocksSubmoduleUtilsStub = container.get(
      Symbols.modules.blocksSubModules.utils
    );

    sandbox                = sinon.createSandbox();
    txs                    = createRandomTransactions({ send: 10 }).map((t) => toBufferedTransaction(t));
    fakeBlock              = createFakeBlock({
      previousBlock: { id: '1', height: 100 } as any,
      timestamp    : constants.timestamp,
      transactions : txs,
    });
    blocksModule           = container.get(Symbols.modules.blocks);
    blocksModule.lastBlock = fakeBlock;
    instance               = container.get(Symbols.api.transport);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('height()', () => {
    it('should return an object with the property height', () => {
      result = instance.height();
      expect(result).to.deep.equal({ height: 101 });
    });
  });

  describe('ping()', () => {
    it('should return an empty object', () => {
      result = instance.ping();
      expect(result).to.deep.equal({});
    });
  });

  describe('list()', () => {
    it('should return an object with the property peers', async () => {
      result = await instance.list();
      expect(result).to.deep.equal({ peers: ['a', 'b', 'c'] });
    });
  });

  describe('signatures()', () => {
    it('should return an object with the property signatures', () => {
      result = instance.signatures();
      expect(result).to.deep.equal({
        signatures: [
          { transaction: '100', signatures: [1, 2, 3] },
          { transaction: '102', signatures: [1, 2, 3] },
        ],
      });
    });
  });

  describe('postSignatures', () => {
    it('should call transportModule.receiveSignatures', async () => {
      transportModuleStub.stubs.receiveSignatures.resolves(true);
      const signatures = [{ transaction: 'transaction', signature: 'signature' }];
      expect(await instance.postSignatures(signatures, undefined)).to.be.true;
      expect(transportModuleStub.stubs.receiveSignatures.calledOnce).to.be.true;
      expect(transportModuleStub.stubs.receiveSignatures.firstCall.args.length).to.be.equal(1);
      expect(transportModuleStub.stubs.receiveSignatures.firstCall.args[0]).to.be.deep.equal(signatures);
    });
  });

  describe('transactions()', () => {
    it('should return an object with the property transactions', () => {
      result = instance.transactions();
      expect(result).to.deep.equal({
        transactions: [{ id: 10 }, { id: 11 }, { id: 12 }],
      });
    });
  });

  describe('postTransactions()', () => {
    it('Many transactions', async () => {
      result = await instance.postTransactions(txs, undefined, {
        headers: { port: '1234' },
        ip     : '8.8.8.8',
        method : 'post',
        url    : '/foo',
      } as any);
      expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
      expect(peersLogicStub.stubs.create.args[0][0]).to.deep.equal(thePeer);
      expect(transportModuleStub.stubs.receiveTransactions.calledOnce).to.be
        .true;
      expect(
        transportModuleStub.stubs.receiveTransactions.args[0][0]
      ).to.deep.equal(txs);
      expect(
        transportModuleStub.stubs.receiveTransactions.args[0][1]
      ).to.deep.equal(thePeer);
      expect(transportModuleStub.stubs.receiveTransactions.args[0][2]).to.be.true;
      expect(result).to.deep.equal({});
    });

    it('One transaction', async () => {
      await instance.postTransactions(
        undefined,
        { id: 100 } as any,
        {
          headers: { port: '1234' },
          ip     : '8.8.8.8',
          method : 'post',
          url    : '/foo2',
        } as any
      );
      expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
      expect(peersLogicStub.stubs.create.args[0][0]).to.deep.equal(thePeer);
      expect(transportModuleStub.stubs.receiveTransactions.calledOnce).to.be
        .true;
      expect(
        transportModuleStub.stubs.receiveTransactions.args[0][0]
      ).to.deep.equal([{ id: 100 }]);
      expect(
        transportModuleStub.stubs.receiveTransactions.args[0][1]
      ).to.deep.equal(thePeer);
      expect(transportModuleStub.stubs.receiveTransactions.args[0][2]).to.be
        .true;
    });

    it('Without transactions and transaction', async () => {
      await instance.postTransactions(
        undefined,
        undefined as any,
        {
          headers: { port: '1234' },
          ip     : '8.8.8.8',
          method : 'post',
          url    : '/foo2',
        } as any
      );
      expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
      expect(peersLogicStub.stubs.create.args[0][0]).to.deep.equal(thePeer);
      expect(transportModuleStub.stubs.receiveTransactions.called).to.be
        .false;
    });
  });

  describe('getBlocksCommon()', () => {
    it('No ids found', async () => {
      await expect(
        instance.getBlocksCommon('', {
          headers: { port: 1234 },
          ip     : '8.8.8.8',
        } as any)
      ).to.be.rejectedWith('Invalid block id sequence');
      expect(peersModuleStub.stubs.remove.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.remove.args[0][0]).to.equal('8.8.8.8');
      expect(peersModuleStub.stubs.remove.args[0][1]).to.equal(1234);
    });

    it('should call blocksModel.findOne with escaped ids and return whatever db returns', async () => {
      const stub = sandbox.stub(blocksModel, 'findOne').resolves({ meow: 'true' });
      const res  = await instance.getBlocksCommon('"1",2,3', {} as any);

      expect(res).to.be.deep.eq({ common: { meow: 'true' } });

      expect(stub.called).is.true;
      const args = stub.firstCall.args[0];
      expect(args.raw).is.true;
      expect(args.attributes).is.deep.eq(['height', 'id', 'previousBlock', 'timestamp']);
      expect(args.where).to.haveOwnProperty('id');
      expect(args.where.id[Op.in]).to.be.deep.eq(['1', '2', '3']);
      expect(args.order).to.be.deep.eq([['height', 'DESC']]);
      expect(args.limit).to.be.deep.eq(1);
    });

  });

  describe('postBlock()', () => {

    it('should remove peer if normalization fails', async () => {
      blockLogicStub.stubs.objectNormalize.throws(new Error('meow'));

      await expect(instance.postBlock(
        { foo: 'bar' } as any,
        { ip: '8.8.8.8', headers: { port: '1234' } } as any
      )).to.be.rejectedWith('meow');

      expect(peersModuleStub.stubs.remove.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.remove.args[0][0]).to.equal('8.8.8.8');
      expect(peersModuleStub.stubs.remove.args[0][1]).to.equal(1234);
    });
    it('should broadcast a bus message', async () => {
      blockLogicStub.enqueueResponse('objectNormalize', { id: 123 });
      await instance.postBlock(
        { id: 'meow' } as any,
        { ip: '8.8.8.8', headers: { port: '1234' } } as any
      );

      expect(busStub.stubs.message.calledOnce).to.be.true;
      expect(busStub.stubs.message.args[0][0]).to.equal('receiveBlock');
      expect(busStub.stubs.message.args[0][1]).to.deep.equal({ id: 123 });
    });
    it('should return block id if all ok', async () => {
      blockLogicStub.enqueueResponse('objectNormalize', { id: 123 });
      const res = await instance.postBlock(
        { id: 'meow' } as any,
        { ip: '8.8.8.8', headers: { port: '1234' } } as any
      );
      expect(res).to.be.deep.eq({ blockId: 123 });
    });
  });

  describe('getBlocks()', () => {
    beforeEach(() => {
      const blocks = [
        createFakeBlock({ timestamp: 1 }),
        createFakeBlock({ timestamp: 2 }),
        createFakeBlock({
          timestamp   : 3,
          transactions: createRandomTransactions({ send: 1, vote: 1, signature: 1, delegate: 1 })
            .map((t) => toBufferedTransaction(t))
        }),
      ].map((b, idx) => {
        const transactions = b.transactions.map((t) => new transactionsModel(t));
        const bm = new blocksModel(b);
        bm.transactions = transactions;
        return bm;
      });
      blocksSubmoduleUtilsStub.enqueueResponse('loadBlocksData', blocks);
    });
    it('should return an object with the property blocks', async () => {
      result = await instance.getBlocks('123');
      expect(result.blocks.length).to.be.deep.eq(2 + 4);

      // TODO: ask matteo to validate response using schema

      expect(result.blocks[0].b_timestamp).to.be.eq(1);
      expect(result.blocks[1].b_timestamp).to.be.eq(2);
      expect(result.blocks[2].b_timestamp).to.be.eq(3);
      expect(result.blocks[3].b_timestamp).to.be.eq(3);
      expect(result.blocks[4].b_timestamp).to.be.eq(3);
      expect(result.blocks[5].b_timestamp).to.be.eq(3);

    });
  });
});
