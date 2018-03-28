import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { TransportAPI } from '../../../src/apis/transportAPI';
import { Symbols } from '../../../src/ioc/symbols';
import {
  BlocksModuleStub,
  BlocksSubmoduleUtilsStub,
  BusStub,
  DbStub,
  PeersLogicStub,
  PeersModuleStub,
  TransactionsModuleStub,
  TransportModuleStub
} from '../../stubs';
import { BlockLogicStub } from '../../stubs/logic/BlockLogicStub';
import { createFakeBlock } from '../../utils/blockCrafter';
import { createContainer } from '../../utils/containerCreator';
import { createRandomTransactions } from '../../utils/txCrafter';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
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
  let dbStub: DbStub;
  let blockLogicStub: BlockLogicStub;
  let busStub: BusStub;
  let blocksSubmoduleUtilsStub: BlocksSubmoduleUtilsStub;

  beforeEach(() => {
    container = createContainer();
    const constants = container.get<any>(Symbols.helpers.constants);

    peersModuleStub = container.get(Symbols.modules.peers);
    peersModuleStub.enqueueResponse('list', {
      consensus: 123,
      peers: ['a', 'b', 'c'],
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
    transportModuleStub.enqueueResponse('receiveTransaction', true);
    transportModuleStub.enqueueResponse('receiveSignatures', Promise.resolve());
    peersLogicStub = container.get(Symbols.logic.peers);
    thePeer = { ip: '8.8.8.8', port: 1234 };
    peersLogicStub.enqueueResponse('create', thePeer);
    container.bind(Symbols.api.transport).to(TransportAPI);
    dbStub = container.get(Symbols.generic.db);
    dbStub.enqueueResponse('query', [true]);
    blockLogicStub = container.get(Symbols.logic.block);
    blockLogicStub.enqueueResponse('objectNormalize', { id: 123 });
    busStub = container.get(Symbols.helpers.bus);
    busStub.enqueueResponse('message', true);
    blocksSubmoduleUtilsStub = container.get(
      Symbols.modules.blocksSubModules.utils
    );
    blocksSubmoduleUtilsStub.enqueueResponse('loadBlocksData', [
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    sandbox = sinon.sandbox.create();
    txs = createRandomTransactions({ send: 10 });
    fakeBlock = createFakeBlock({
      previousBlock: { id: '1', height: 100 } as any,
      timestamp: constants.timestamp,
      transactions: txs,
    });
    blocksModule = container.get(Symbols.modules.blocks);
    blocksModule.lastBlock = fakeBlock;
    instance = container.get(Symbols.api.transport);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('height()', () => {
    it('success', () => {
      result = instance.height();
      expect(result).to.deep.equal({ height: 101 });
    });
  });

  describe('ping()', () => {
    it('success', () => {
      result = instance.ping();
      expect(result).to.deep.equal({});
    });
  });

  describe('list()', () => {
    it('success', async () => {
      result = await instance.list();
      expect(result).to.deep.equal({ peers: ['a', 'b', 'c'] });
    });
  });

  describe('signatures()', () => {
    it('success', () => {
      result = instance.signatures();
      expect(result).to.deep.equal({
        signatures: [
          { transaction: '100', signatures: [1, 2, 3] },
          { transaction: '102', signatures: [1, 2, 3] },
        ],
      });
    });
  });

  describe('postSignatures()', () => {
    it('should call transportModule.receiveSignatures', async () => {
      transportModuleStub.stubs.receiveSignatures.resolves(true);
      const signatures = [{transaction: 'abc', signature: 'def'}];
      result = await instance.postSignatures(signatures);
      expect(result).to.be.true;
      expect(transportModuleStub.stubs.receiveSignatures.calledOnce).to.be.true;
      expect(transportModuleStub.stubs.receiveSignatures.firstCall.args.length).to.be.equal(1);
      expect(transportModuleStub.stubs.receiveSignatures.firstCall.args[0]).to.be.deep.equal(signatures);
    });
  });

  describe('transactions()', () => {
    it('success', () => {
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
        ip: '8.8.8.8',
        method: 'post',
        url: '/foo',
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
      expect(transportModuleStub.stubs.receiveTransactions.args[0][2]).to.equal(
        'post /foo'
      );
      expect(result).to.deep.equal({});
      expect(transportModuleStub.stubs.receiveTransaction.called).to.be.false;
    });

    it('One transaction', async () => {
      await instance.postTransactions(
        undefined,
        { id: 100 } as any,
        {
          headers: { port: '1234' },
          ip: '8.8.8.8',
          method: 'post',
          url: '/foo2',
        } as any
      );
      expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
      expect(peersLogicStub.stubs.create.args[0][0]).to.deep.equal(thePeer);
      expect(transportModuleStub.stubs.receiveTransaction.calledOnce).to.be
        .true;
      expect(
        transportModuleStub.stubs.receiveTransaction.args[0][0]
      ).to.deep.equal({ id: 100 });
      expect(
        transportModuleStub.stubs.receiveTransaction.args[0][1]
      ).to.deep.equal(thePeer);
      expect(transportModuleStub.stubs.receiveTransaction.args[0][2]).to.be
        .false;
      expect(transportModuleStub.stubs.receiveTransaction.args[0][3]).to.equal(
        'post /foo2'
      );
      expect(transportModuleStub.stubs.receiveTransactions.called).to.be
        .false;
    });

    it('Without transactions and transaction', async () => {
      await instance.postTransactions(
        undefined,
        undefined as any,
        {
          headers: { port: '1234' },
          ip: '8.8.8.8',
          method: 'post',
          url: '/foo2',
        } as any
      );
      expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
      expect(peersLogicStub.stubs.create.args[0][0]).to.deep.equal(thePeer);
      expect(transportModuleStub.stubs.receiveTransaction.calledOnce).to.be
        .false;
      expect(transportModuleStub.stubs.receiveTransactions.called).to.be
        .false;
    });
  });

  describe('getBlocksCommon()', () => {
    it('No ids found', async () => {
      await expect(
        instance.getBlocksCommon('', {
          headers: { port: 1234 },
          ip: '8.8.8.8',
        } as any)
      ).to.be.rejectedWith('Invalid block id sequence');
      expect(peersModuleStub.stubs.remove.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.remove.args[0][0]).to.equal('8.8.8.8');
      expect(peersModuleStub.stubs.remove.args[0][1]).to.equal(1234);
    });

    it('success #1', async () => {
      result = await instance.getBlocksCommon('1,2,3', {} as any);
      expect(result).to.deep.equal({ common: true });
      expect(dbStub.stubs.query.calledOnce).to.be.true;
      // tslint:disable max-line-length
      expect(dbStub.stubs.query.args[0][0]).to.equal(
        'SELECT MAX("height") AS "height", "id", "previousBlock", "timestamp" FROM blocks WHERE "id" IN ($1:csv) GROUP BY "id" ORDER BY "height" DESC'
      );
      expect(dbStub.stubs.query.args[0][1]).to.deep.equal(['1', '2', '3']);
    });

    it('success #2', async () => {
      dbStub.stubs.query.returns([]);
      result = await instance.getBlocksCommon('1,2,3', {} as any);
      expect(result).to.deep.equal({ common: null });
      expect(dbStub.stubs.query.calledOnce).to.be.true;
      // tslint:disable max-line-length
      expect(dbStub.stubs.query.args[0][0]).to.equal(
        'SELECT MAX("height") AS "height", "id", "previousBlock", "timestamp" FROM blocks WHERE "id" IN ($1:csv) GROUP BY "id" ORDER BY "height" DESC'
      );
      expect(dbStub.stubs.query.args[0][1]).to.deep.equal(['1', '2', '3']);
    });
  });

  describe('postBlock()', () => {
    it('success', async () => {
      result = await instance.postBlock(
        { foo: 'bar' } as any,
        { ip: '8.8.8.8', headers: { port: '1234' } } as any
      );
      expect(result).to.deep.equal({ blockId: 123 });
      expect(blockLogicStub.stubs.objectNormalize.calledOnce).to.be.true;
      expect(blockLogicStub.stubs.objectNormalize.args[0][0]).to.deep.equal({
        foo: 'bar',
      });
      expect(busStub.stubs.message.calledOnce).to.be.true;
      expect(busStub.stubs.message.args[0][0]).to.equal('receiveBlock');
      expect(busStub.stubs.message.args[0][1]).to.deep.equal({ id: 123 });
    });

    it('error', async () => {
      blockLogicStub.stubs.objectNormalize.throws(
        new Error('objectNormalizeError')
      );
      await expect(
        instance.postBlock(
          { foo: 'bar' } as any,
          { ip: '8.8.8.8', headers: { port: '1234' } } as any
        )
      ).to.be.rejectedWith('objectNormalizeError');
      expect(blockLogicStub.stubs.objectNormalize.calledOnce).to.be.true;
      expect(blockLogicStub.stubs.objectNormalize.args[0][0]).to.deep.equal({
        foo: 'bar',
      });
      expect(peersModuleStub.stubs.remove.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.remove.args[0][0]).to.equal('8.8.8.8');
      expect(peersModuleStub.stubs.remove.args[0][1]).to.equal(1234);
    });
  });

  describe('getBlocks()', () => {
    it('success', async () => {
      result = await instance.getBlocks('123');
      expect(result).to.deep.equal({
        blocks: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });
      expect(blocksSubmoduleUtilsStub.stubs.loadBlocksData.calledOnce).to.be
        .true;
      expect(
        blocksSubmoduleUtilsStub.stubs.loadBlocksData.args[0][0]
      ).to.deep.equal({ lastId: '123', limit: 34 });
    });
  });
});
