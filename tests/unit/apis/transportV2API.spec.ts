import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Op } from 'sequelize';
import { TransportV2API } from '../../../src/apis';
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
import BigNumber from 'bignumber.js';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/transportV2API', () => {
  let sandbox: SinonSandbox;
  let instance: TransportV2API;
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
  let res: any;
  let sendResponseStub: SinonStub;
  let fakePeers: any[];
  beforeEach(() => {
    container         = createContainer();
    const constants   = container.get<any>(Symbols.helpers.constants);
    blocksModel       = container.get(Symbols.models.blocks);
    transactionsModel = container.get(Symbols.models.transactions);
    peersModuleStub   = container.get(Symbols.modules.peers);
    fakePeers = ['a', 'b', 'c'].map((p) => {
      return { object: () => p };
    });
    peersModuleStub.enqueueResponse('list', {
      consensus: 123,
      peers    : fakePeers,
    });
    peersModuleStub.enqueueResponse('remove', true);
    transactionsModuleStub = container.get(Symbols.modules.transactions);
    transactionsModuleStub.enqueueResponse('getMultisignatureTransactionList', [
      { id: '100', signatures: ['01', '02', '03'] },
      { id: '101', signatures: [] },
      { id: '102', signatures: ['04', '05', '06'] },
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
    container.bind(Symbols.api.transportV2).to(TransportV2API);
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
    instance               = container.get(Symbols.api.transportV2);
    res = {};
    sendResponseStub = sandbox.stub(instance as any, 'sendResponse');
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('list()', () => {
    it('should call sendResponse passing an object with the property peers', async () => {
      result = await instance.list(res);
      expect(sendResponseStub.calledOnce).to.be.true;
      expect(sendResponseStub.firstCall.args).to.be.deep.equal([res, {peers: fakePeers}, 'transportPeers']);
    });
  });

  describe('signatures()', () => {
    it('should call sendResponse passing an object with the property signatures, of buffers and BigNum', () => {
      result = instance.signatures(res);
      expect(sendResponseStub.calledOnce).to.be.true;
      expect(sendResponseStub.firstCall.args).to.be.deep.equal([res, {
        signatures: [
          {
            signatures: [Buffer.from('01', 'hex'), Buffer.from('02', 'hex'), Buffer.from('03', 'hex')],
            transaction: new BigNumber('100'),
          },
          {
            signatures: [Buffer.from('04', 'hex'), Buffer.from('05', 'hex'), Buffer.from('06', 'hex')],
            transaction: new BigNumber('102'),
          },
        ],
      }, 'tranportSignatures']);
    });
  });

  describe('postSignatures', () => {
    it('should parse the request');
    it('should validate the data via schema');
    it('should return an error response if request is not parsable');
    it('should return an error response if schema does not validate');
    it('should call receiveSignatures');
    it('should respond with APISuccess');
  });

  describe('transactions()', () => {
    it('should get transactions list');
    it('should call generateBytesTransaction for each tx');
    it('should call sendResponse passing an object with the property transactions');
  });

  describe('postTransactions()', () => {
    it('should parse the request');
    it('should return an error response if request is not parsable');
    it('should call peersLogic.create');
    it('should call receiveTransactions');
    it('should respond with APISuccess');
  });

  describe('postBlock()', () => {
    it('should parse the request');
    it('should call BlockLogic.fromBytes');
    it('should call objectNormalize');
    it('should throw and remove peer if parseRequest throws');
    it('should throw and remove peer if objectNormalize throws');
    it('should throw and remove peer if fromBytes throws');
    it('should call peersLogic.create');
    it('should call bus.message');
    it('should respond with transportBlockResponse');
  });

  describe('getBlocks()', () => {
    it('should call loadBlocksData');
    it('should call generateBytesBlock for each block');
    it('should call objectNormalize');
    it('should respond with transportBlocks message');
  });

  describe('sendResponse()', () => {
    it('should set content type');
    it('should call protoBuf.validate');
    it('should call protoBuf.encode');
    it('should call res.status(200)');
    it('should call error if anything fails');
  });

  describe('error()', () => {
    it('should call res.status with the right status');
    it('should protoBuf.encode with APIError');
  });

  describe('generateBytesTransaction()', () => {
    it('should call getBytes');
    it('should included all fields');
  });

  describe('generateBytesBlock()', () => {
    it('should call getBytes');
    it('should call generateBytesTransaction for each tx');
    it('should include all fields');
  });

  describe('parseRequest()', () => {
    it('should throw if req has no protoBuf');
    it('should call protoBuf.decode');
    it('should throw if decode fails');
  });
});
