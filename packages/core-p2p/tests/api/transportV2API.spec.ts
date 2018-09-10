import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as Long from 'long';
import * as proxyquire from 'proxyquire';
import { Op } from 'sequelize';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { SchemaValid, ValidateSchema } from '@risevision/core-utils';
import { TransportV2API } from '../../src/api/transportv2API';
import {
  IBlockLogic,
  IBlocksModel,
  IBlocksModule,
  IPeersLogic, IPeersModule, ITransactionLogic, ITransactionsModel,
  ITransactionsModule,
  ITransportModule, Symbols
} from '@risevision/core-interfaces';
import { BlockLogic } from '../../../core-blocks/src/logic';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { p2pSymbols, ProtoBufHelper } from '../../src/helpers';
import { TransactionLogic } from '../../../core-transactions/src';
import { createRandomTransactions, toBufferedTransaction } from '../../../core-transactions/tests/utils/txCrafter';
import * as Sinon from 'sinon';
import { AccountLogic } from '../../../core-accounts/src/logic';
import { createFakeBlock } from '../../../core-blocks/tests/utils/createFakeBlocks';
import { RequestFactoryType } from '../../src/utils';
import { ProtoBufHelperStub } from '../stubs/protobufhelperStub';
import { peers } from 'dpos-api-wrapper/dist/es5/apis';
import { ConstantsType } from '@risevision/core-types';
import { ModelSymbols } from '@risevision/core-models';

const validatorStubs: any = {
  SchemaValid,
  ValidateSchema,
  assertValidSchema: () => true,
};
const ProxyTransportV2API = proxyquire('../../src/api/transportv2API', {
  '@risevision/core-utils': validatorStubs,
});

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
// tslint:disable no-big-function
describe('apis/transportV2API', () => {
  let sandbox: SinonSandbox;
  let instance: TransportV2API;
  let container: Container;
  let constants: ConstantsType;
  let result: any;
  let fakeBlock: any;
  let blocksModule: IBlocksModule;
  let peersLogicStub: IPeersLogic;
  let peersModuleStub: IPeersModule;
  let transactionLogicStub: ITransactionLogic;
  let transactionsModuleStub: ITransactionsModule;
  let txs: any;
  let transportModuleStub: ITransportModule;
  let thePeer: any;
  let blockLogicStub: IBlockLogic;
  let blocksModel: typeof IBlocksModel;
  let transactionsModel: typeof ITransactionsModel;
  let res: any;
  let req: any;
  let generateBytesTransactionStub: SinonStub;
  let fakePeers: any[];
  let protoBufStub: ProtoBufHelperStub;

  let getMergedTransactionList: SinonStub;
  let peersLogicCreateStub: SinonStub;
  let receiveTXStub: SinonStub;
  let peersModuleRemoveStub: SinonStub;

  beforeEach(async () => {
    sandbox                = sinon.createSandbox();
    container    = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
    container.rebind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelperStub).inSingletonScope();
    constants   = container.get<any>(Symbols.generic.constants);
    blocksModel       = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
    transactionLogicStub = container.get(Symbols.logic.transaction);
    transactionsModel = container.getNamed(ModelSymbols.model, Symbols.models.transactions);
    peersModuleStub   = container.get(Symbols.modules.peers);
    fakePeers = ['a', 'b', 'c'].map((p) => {
      return { object: () => p };
    });
    sandbox.stub(peersModuleStub, 'list').returns({
      consensus: 123,
      peers    : fakePeers,
    });
    peersModuleRemoveStub = sandbox.stub(peersModuleStub, 'remove').returns(true);
    transactionsModuleStub = container.get(Symbols.modules.transactions);

    // sandbox.stub(transactionsModuleStub,  'getMultisignatureTransactionList').returns([
    //   { id: '100', signatures: ['01', '02', '03'] },
    //   { id: '101', signatures: [] },
    //   { id: '102', signatures: ['04', '05', '06'] },
    // ]);

    getMergedTransactionList = sandbox.stub(transactionsModuleStub, 'getMergedTransactionList').returns([
      { id: 10 },
      { id: 11 },
      { id: 12 },
    ]);
    transportModuleStub = container.get(Symbols.modules.transport);
    // receiveTXStub = sandbox.stub(transportModuleStub, 'receiveTransactions').returns(true);
    // sandbox.stub(transportModuleStub,  'receiveSignatures').resolves();
    peersLogicStub = container.get(Symbols.logic.peers);
    thePeer        = { ip: '8.8.8.8', port: 1234 };
    peersLogicCreateStub = sandbox.stub(peersLogicStub, 'create').returns(thePeer);
    container.rebind(p2pSymbols.controller)
      .to(ProxyTransportV2API.TransportV2API)
      .inSingletonScope()
      .whenTargetNamed(p2pSymbols.api.transportV2);

    blockLogicStub = container.get(Symbols.logic.block);
    // busStub        = container.get(Symbols.helpers.bus);
    // busStub.enqueueResponse('message', true);
    // blocksSubmoduleUtilsStub = container.get(
    //   Symbols.modules.blocksSubModules.utils
    // );


    txs                    = createRandomTransactions(10)
      .map((t) => toBufferedTransaction(t));
    fakeBlock              = createFakeBlock(container, {
      previousBlock: { id: '1', height: 100 } as any,
      timestamp    : constants.epochTime.getTime(),
      transactions : txs,
    });
    blocksModule           = container.get(Symbols.modules.blocks);
    blocksModule.lastBlock = fakeBlock;
    instance               = container.getNamed(p2pSymbols.controller, p2pSymbols.api.transportV2);
    res = {};
    req = { headers: {port: 5555}, ip: '80.3.10.20', method: 'aaa', protoBuf: Buffer.from('aabbcc', 'hex'),
      url: 'bbb', };
    validatorStubs.assertValidSchema = sandbox.stub().returns(true);
    validatorStubs.SchemaValid = sandbox.stub().returns(true);
    validatorStubs.ValidateSchema = sandbox.stub().returns(true);
    protoBufStub = container.get(p2pSymbols.helpers.protoBuf);
    protoBufStub.stubs.validate.returns(true);
    protoBufStub.stubs.encode.callsFake((data) => new Buffer(JSON.stringify(data), 'utf8'));
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('list()', () => {
    it('should enqueue into buffer', async () => {
      result = await instance.list();
      expect(result).to.be.an.instanceOf(Buffer);
      expect(protoBufStub.stubs.encode.called).true;
      expect(protoBufStub.stubs.encode.firstCall.args)
        .deep.eq([
        { peers: fakePeers },
        'p2p.peers',
        'transportPeers',
      ]);
    });
  });

  // describe('signatures()', () => {
  //   it('should call encode passing an object with the property signatures, of buffers and BigNum', async () => {
  //     result = await instance.signatures();
  //     expect(protoBufStub.stubs.encode.called).true;
  //     expect(protoBufStub.stubs.encode.firstCall.args)
  //       .deep.eq([
  //       {
  //         signatures: [
  //           {
  //             signatures: [Buffer.from('01', 'hex'), Buffer.from('02', 'hex'), Buffer.from('03', 'hex')],
  //             transaction: Long.fromString('100'),
  //           },
  //           {
  //             signatures: [Buffer.from('04', 'hex'), Buffer.from('05', 'hex'), Buffer.from('06', 'hex')],
  //             transaction: Long.fromString('102'),
  //           },
  //         ],
  //       },
  //       'transportSignatures', 'getSignaturesResponse']);
  //   });
  // });
  //
  // describe('postSignatures', () => {
  //   let parseRequestStub: SinonStub;
  //   beforeEach(() => {
  //     parseRequestStub = sandbox.stub(instance as any, 'parseRequest');
  //   });
  //
  //   it('should parse the request', async () => {
  //     parseRequestStub.returns({signatures: []});
  //     result = await instance.postSignatures('meow' as any);
  //     expect(parseRequestStub.calledOnce).to.be.true;
  //     expect(parseRequestStub.firstCall.args).to.be.deep.equal(['meow', 'transportSignatures', 'postSignatures']);
  //   });
  //
  //   it('should validate the data via schema', async () => {
  //     parseRequestStub.returns({signatures: []});
  //     result = await instance.postSignatures(null);
  //     expect(validatorStubs.assertValidSchema.calledOnce).to.be.true;
  //     expect(validatorStubs.assertValidSchema.firstCall.args.slice(1)).to.be.deep.equal([
  //       [],
  //       {obj: transportSchema.signatures.properties.signatures, opts: { errorString: 'Error validating schema.'} },
  //     ]);
  //   });
  //
  //   it('should return an error response if request is not parsable', async () => {
  //     const err = new Error('sig err');
  //     parseRequestStub.throws(err);
  //     await expect(instance.postSignatures(null)).rejectedWith(err);
  //   });
  //
  //   it('should return an error response if schema does not validate', async () => {
  //     const err = new Error('val err');
  //     parseRequestStub.returns({signatures: []});
  //     validatorStubs.assertValidSchema.throws(err);
  //     await expect(instance.postSignatures(null)).rejectedWith(err);
  //   });
  //
  //   it('should accept a single signature', async () => {
  //     parseRequestStub.returns({signature: {
  //       signature: Buffer.from('1122334455aa', 'hex'),
  //       transaction: Long.fromString('12323423523623626'),
  //     }});
  //     validatorStubs.assertValidSchema.returns(true);
  //     instance.postSignatures(null);
  //     expect(transportModuleStub.stubs.receiveSignatures.firstCall.args[0]).to.be.deep.equal([{
  //       signature: '1122334455aa',
  //       transaction: '12323423523623626',
  //     }]);
  //   });
  //
  //   it('should call receiveSignatures', async () => {
  //     parseRequestStub.returns({
  //       signatures: [
  //         {
  //           signature  : new Buffer('abcd', 'hex'),
  //           transaction: '1',
  //         },
  //         {
  //           signature  : new Buffer('0011', 'hex'),
  //           transaction: '2',
  //         },
  //       ],
  //     });
  //     validatorStubs.assertValidSchema.returns(true);
  //     result = await instance.postSignatures(null);
  //     expect(transportModuleStub.stubs.receiveSignatures.calledOnce).to.be.true;
  //     expect(transportModuleStub.stubs.receiveSignatures.firstCall.args[0]).to.be.deep.equal([
  //       { signature: 'abcd', transaction: '1'},
  //       { signature: '0011', transaction: '2'},
  //     ]);
  //   });
  //
  //   it('should respond with APISuccess', async () => {
  //     parseRequestStub.returns({signatures : []});
  //     validatorStubs.assertValidSchema.returns(true);
  //     result = await instance.postSignatures(null);
  //     expect(result.toString()).deep.eq('{"success":true}');
  //   });
  // });

  // TODO: Move to corresponding modules.
  // describe('transactions()', () => {
  //   beforeEach(() => {
  //     generateBytesTransactionStub = sandbox.stub().returns(Buffer.from('0123', 'hex'));
  //     (instance as any).ptFactory = () => ({
  //       generateBytesTransaction: generateBytesTransactionStub,
  //     });
  //   });
  //   it('should get transactions list', async () => {
  //     await instance.transactions();
  //     expect(getMergedTransactionList.calledOnce).to.be.true;
  //     expect(getMergedTransactionList.firstCall.args).to.be.deep.equal([
  //       constants.maxSharedTxs,
  //     ]);
  //   });
  //
  //   it('should call generateBytesTransaction for each tx', async () => {
  //     getMergedTransactionList.returns(txs);
  //     await instance.transactions();
  //     expect(generateBytesTransactionStub.callCount).to.be.equal(txs.length);
  //     expect(generateBytesTransactionStub.args).to.be.deep.equal(txs.map((tx) => [tx]));
  //   });
  //
  //   it('should call sendResponse passing an object with the property transactions', async () => {
  //     getMergedTransactionList.returns(txs);
  //     await instance.transactions();
  //     expect(protoBufStub.stubs.encode.calledOnce).is.true;
  //     expect(protoBufStub.stubs.encode.firstCall.args).deep.eq([
  //       { transactions: txs.map(() => Buffer.from('0123', 'hex')), },
  //       'transportTransactions',
  //       undefined,
  //     ]);
  //   });
  // });
  //
  // describe('postTransactions()', () => {
  //   let parseRequestStub: SinonStub;
  //   let fromBytesStub: SinonStub;
  //   beforeEach(() => {
  //     parseRequestStub = sandbox.stub(instance as any, 'parseRequest');
  //     fromBytesStub = sandbox.stub(transactionLogicStub, 'fromBytes');
  //   });
  //
  //   it('should parse the request', async () => {
  //     parseRequestStub.returns({transactions: []});
  //     req.body = 'meow';
  //     result = await instance.postTransactions(req);
  //     expect(parseRequestStub.calledOnce).to.be.true;
  //     expect(parseRequestStub.firstCall.args).to.be.deep.equal(['meow', 'transportTransactions']);
  //   });
  //
  //   it('should return an error response if request is not parsable', async () => {
  //     const err = new Error('tx err');
  //     parseRequestStub.throws(err);
  //     await expect(instance.postTransactions(req)).rejectedWith(err);
  //   });
  //
  //   it('should call peersLogic.create', async () => {
  //     parseRequestStub.returns({transactions: []});
  //     result = await instance.postTransactions(req);
  //     expect(peersLogicCreateStub.calledOnce).to.be.true;
  //     expect(peersLogicCreateStub.firstCall.args).to.be.deep.equal([{
  //       ip  : req.ip,
  //       port: parseInt(req.headers.port as string, 10),
  //     }]);
  //   });
  //
  //   it('should handle a single transaction', async () => {
  //     parseRequestStub.returns({transaction: 'singleTx'});
  //     fromBytesStub.callsFake((what) => ({id: what}));
  //     result = await instance.postTransactions(req);
  //     expect(receiveTXStub.firstCall.args).to.be.deep.equal([
  //       [{id: 'singleTx'}],
  //       peersLogicCreateStub.firstCall.returnValue,
  //       true,
  //     ]);
  //   });
  //
  //   it('should call receiveTransactions after calling fromBytes for each tx', async () => {
  //     const thetxs = ['tx1', 'tx2', 'tx3'];
  //     parseRequestStub.returns({transactions: thetxs});
  //     fromBytesStub.callsFake((what) => ({id: what}));
  //     result = await instance.postTransactions(req);
  //     expect(fromBytesStub.callCount).to.be.equal(thetxs.length);
  //     expect(fromBytesStub.args).to.be.deep.equal([['tx1'], ['tx2'], ['tx3']]);
  //     expect(receiveTXStub.calledOnce).to.be.true;
  //     expect(receiveTXStub.firstCall.args).to.be.deep.equal([
  //       [{id: 'tx1'}, {id: 'tx2'}, {id: 'tx3'}],
  //       peersLogicCreateStub.firstCall.returnValue,
  //       true,
  //     ]);
  //   });
  //   it('should respond with APISuccess', async () => {
  //     const thetxs = ['tx1', 'tx2', 'tx3'];
  //     parseRequestStub.returns({transactions: thetxs});
  //     fromBytesStub.returns('a');
  //     result = await instance.postTransactions(req);
  //     expect(protoBufStub.stubs.encode.calledOnce).is.true;
  //     expect(protoBufStub.stubs.encode.firstCall.args).deep.eq([
  //       {success: true},
  //       'APISuccess',
  //       undefined,
  //     ]);
  //   });
  // });
  //
  // describe('getBlocksCommon()', () => {
  //   let findOneStub: SinonStub;
  //   let genBBStub: SinonStub;
  //   let getResStub: SinonStub;
  //   beforeEach(() => {
  //     findOneStub = sandbox.stub(blocksModel, 'findOne');
  //     genBBStub = sandbox.stub().returns(Buffer.from('aaa123', 'hex'));
  //     (instance as any).pblocksFactory = () => ({
  //       generateBytesBlock: genBBStub,
  //     });
  //     getResStub = sandbox.stub(instance as any, 'getResponse').returns({success: true});
  //   });
  //
  //   it('should accept and remove quotes in ids', async () => {
  //     findOneStub.returns(null);
  //     await instance.getBlocksCommon('"123",\'456\'', req);
  //     expect(findOneStub.calledOnce).to.be.true;
  //     expect(findOneStub.firstCall.args[0].where.id[Op.in]).to.be.deep.equal(['123', '456']);
  //   });
  //
  //   it('should remove non numeric ids', async () => {
  //     findOneStub.returns(null);
  //     await instance.getBlocksCommon('123,nonNumericID,456', req);
  //     expect(findOneStub.calledOnce).to.be.true;
  //     expect(findOneStub.firstCall.args[0].where.id[Op.in]).to.be.deep.equal(['123', '456']);
  //   });
  //
  //   it('should call peersModule.remove and throw if no valid id is found', async () => {
  //     findOneStub.returns(null);
  //     await expect(instance.getBlocksCommon('invalidID', req)).to.be.rejectedWith('Invalid block id sequence');
  //     expect(peersModuleRemoveStub.calledOnce).to.be.true;
  //     expect(peersModuleRemoveStub.firstCall.args).to.be.deep
  //       .equal([req.ip, parseInt(req.headers.port as string, 10)]);
  //   });
  //
  //   it('should call peersModule.remove if more than 10 ids were passed', async () => {
  //     findOneStub.returns(null);
  //     await expect(instance.getBlocksCommon('1,2,3,4,5,6,7,8,9,10,11', req))
  //       .to.be.rejectedWith('Invalid block id sequence');
  //     expect(peersModuleRemoveStub.calledOnce).to.be.true;
  //     expect(peersModuleRemoveStub.firstCall.args).to.be.deep
  //       .equal([req.ip, parseInt(req.headers.port as string, 10)]);
  //   });
  //
  //   it('should call BlocksModel.findOne', async () => {
  //     findOneStub.returns(null);
  //     await instance.getBlocksCommon('123,456', req);
  //     expect(findOneStub.calledOnce).to.be.true;
  //     expect(findOneStub.firstCall.args).to.be.deep
  //       .equal([{
  //         limit: 1,
  //         order: [['height', 'DESC']],
  //         raw: true,
  //         where: {
  //           id: {
  //             [Op.in]: ['123', '456'],
  //           },
  //         },
  //       }]);
  //   });
  //
  //   it('should call generateBytesBlock if findOne returns a valid block', async () => {
  //     findOneStub.returns({blockId: '123456'});
  //     await instance.getBlocksCommon('1,2,3', req);
  //     expect(genBBStub.calledOnce).to.be.true;
  //     expect(genBBStub.firstCall.args).to.be.deep.equal([{blockId: '123456'}]);
  //   });
  //
  //   it('should set the block to null if findOne returns null', async () => {
  //     findOneStub.returns(null);
  //     genBBStub.callsFake((a) => a);
  //     await instance.getBlocksCommon('1,2,3', req);
  //     expect(genBBStub.notCalled).to.be.true;
  //     expect(getResStub.calledOnce).to.be.true;
  //     expect(getResStub.firstCall.args).to.be.deep.equal([{common: null}, 'transportBlocks', 'commonBlock']);
  //   });
  //
  //   it('should call getResponse and return', async () => {
  //     getResStub.returns('success');
  //     findOneStub.returns({blockId: '123456'});
  //     genBBStub.callsFake((a) => a);
  //     const ret = await instance.getBlocksCommon('1,2,3', req);
  //     expect(getResStub.calledOnce).to.be.true;
  //     expect(getResStub.firstCall.args).to.be.deep
  //       .equal([{common: {blockId: '123456'}}, 'transportBlocks', 'commonBlock']);
  //     expect(ret).to.be.equal('success');
  //   });
  //
  //   it('getResponse should throw if invalid data is passed', async () => {
  //     getResStub.restore();
  //     genBBStub.returns('InvalidDataForProtoBuf');
  //     protoBufStub.stubs.validate.returns(false);
  //     await expect(instance.getBlocksCommon('1,2,3', req)).to.be.rejectedWith(/Failed to encode response - /);
  //   });
  // });
  //
  // describe('postBlock()', () => {
  //   let parseRequestStub: SinonStub;
  //   let blockFromBytes: SinonStub;
  //   let blockObjNormalize: SinonStub;
  //   beforeEach(() => {
  //     parseRequestStub = sandbox.stub(instance as any, 'parseRequest');
  //     blockFromBytes = sandbox.stub(blockLogicStub, 'fromBytes').returns({id: '1'});
  //     blockObjNormalize = sandbox.stub(blockLogicStub, 'objectNormalize').callsFake((a) => a);
  //   });
  //
  //   it('should parse the request', async () => {
  //     parseRequestStub.returns({block: 'block'});
  //     req.body = {cat: 'meows'};
  //     result = await instance.postBlock(req);
  //     expect(parseRequestStub.calledOnce).to.be.true;
  //     expect(parseRequestStub.firstCall.args).to.be.deep.equal([{cat: 'meows'}, 'transportBlocks', 'transportBlock']);
  //   });
  //
  //   it('should call BlockLogic.fromBytes', async () => {
  //     const blk = {block: 'theBlock'};
  //     parseRequestStub.returns(blk);
  //     result = await instance.postBlock(req);
  //     expect(blockFromBytes.calledOnce).to.be.true;
  //     expect(blockFromBytes.firstCall.args).to.be.deep.equal([blk.block]);
  //   });
  //
  //   it('should call objectNormalize', async () => {
  //     const blk = {block: 'theBlock'};
  //     parseRequestStub.returns(blk);
  //     result = await instance.postBlock(req);
  //     expect(blockObjNormalize.calledOnce).to.be.true;
  //     expect(blockObjNormalize.firstCall.args).to.be.deep.equal([{id: '1'}]);
  //   });
  //
  //   it('should throw and remove peer if parseRequest throws', async () => {
  //     const err = new Error('pr err');
  //     parseRequestStub.throws(err);
  //     await expect(instance.postBlock(req)).to.be.rejectedWith(err);
  //     expect(peersModuleRemoveStub.calledOnce).to.be.true;
  //     expect(peersModuleRemoveStub.firstCall.args)
  //       .to.be.deep.equal([req.ip, parseInt(req.headers.port as string, 10)]);
  //   });
  //
  //   it('should throw and remove peer if objectNormalize throws', async () => {
  //     const blk = {block: 'theBlock'};
  //     parseRequestStub.returns(blk);
  //     const err = new Error('on err');
  //     blockObjNormalize.throws(err);
  //     await expect(instance.postBlock(req)).to.be.rejectedWith(err);
  //     expect(peersModuleRemoveStub.calledOnce).to.be.true;
  //     expect(peersModuleRemoveStub.firstCall.args)
  //       .to.be.deep.equal([req.ip, parseInt(req.headers.port as string, 10)]);
  //   });
  //
  //   it('should throw and remove peer if fromBytes throws', async () => {
  //     const blk = {block: 'theBlock'};
  //     parseRequestStub.returns(blk);
  //     const err = new Error('fb err');
  //     blockFromBytes.throws(err);
  //     await expect(instance.postBlock(req)).to.be.rejectedWith(err);
  //     expect(peersModuleRemoveStub.calledOnce).to.be.true;
  //     expect(peersModuleRemoveStub.firstCall.args)
  //       .to.be.deep.equal([req.ip, parseInt(req.headers.port as string, 10)]);
  //   });
  //
  //   it('should call bus.message', async () => {
  //     // TODO: Check hookSystem
  //   });
  //
  //   it('should respond with transportBlockResponse', async () => {
  //     const blk = {block: 'theBlock'};
  //     parseRequestStub.returns(blk);
  //     const thaRes = await instance.postBlock(req);
  //     expect(thaRes.toString()).eq(JSON.stringify({success: true, blockId: '1'}));
  //     expect(protoBufStub.stubs.encode.calledOnce).is.true;
  //     expect(protoBufStub.stubs.encode.firstCall.args[0]).deep.eq({success: true, blockId: '1'});
  //     expect(protoBufStub.stubs.encode.firstCall.args[1]).eq('transportBlocks');
  //     expect(protoBufStub.stubs.encode.firstCall.args[2]).eq('transportBlockResponse');
  //   });
  //
  //   describe('unstubbed tests', () => {
  //     beforeEach(() => {
  //       container.rebind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelper).inSingletonScope();
  //       container.rebind(p2pSymbols.controller)
  //         .to(TransportV2API)
  //         .inSingletonScope()
  //         .whenTargetNamed(p2pSymbols.api.transportV2);
  //       instance               = container.getNamed(p2pSymbols.controller, p2pSymbols.api.transportV2);
  //     });
  //     it('should throw if request body is not in binary', async () => {
  //       await expect(instance.postBlock(req)).rejectedWith('No binary data in request body');
  //     });
  //     it('should throw if data is not decodable', async () => {
  //       req.body = Buffer.from('meow', 'utf8');
  //       await expect(instance.postBlock(req)).rejectedWith('Invalid binary data for message');
  //     });
  //     it('should not throw if data is in correct format', async () => {
  //       // container.rebind(Symbols.logic.block).to(BlockLogic).inSingletonScope();
  //       // container.rebind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();
  //       // container.rebind(Symbols.logic.account).to(AccountLogic).inSingletonScope();
  //       // container.rebind(Symbols.helpers.protoBuf).to(ProtoBufHelper).inSingletonScope();
  //       const txLogic: TransactionLogic = container.get(Symbols.logic.transaction);
  //       // txLogic.attachAssetType(container.get(Symbols.logic.transactions.send));
  //
  //       // container.rebind(Symbols.logic.pro).to(BlockLogic).inSingletonScope();
  //       const pbFactory = container.get<RequestFactoryType<any, PostBlocksRequest>>(p2pSymbols.requests.postBlocks);
  //       const data = pbFactory({data: {block: fakeBlock}}).getRequestOptions(true);
  //       expect(Buffer.isBuffer(data.data)).true;
  //       req.body = data.data;
  //       instance = container.getNamed(p2pSymbols.controller, p2pSymbols.api.transportV2);
  //       await instance.postBlock(req);
  //     });
  //   });
  // });

  // describe('getBlocks()', () => {
  //   let blocks;
  //   let generateBytesBlockStub: SinonStub;
  //   let numblocksToLoadStub: SinonStub;
  //   beforeEach(() => {
  //     (instance as any).BlocksModel = {
  //       findOne: sandbox.stub().resolves({
  //         height: 123456,
  //       }),
  //     };
  //     numblocksToLoadStub = sandbox.stub(instance as any, 'calcNumBlocksToLoad').resolves(2100);
  //     blocks = ['blk1', 'blk2', 'blk3'];
  //     blocksSubmoduleUtilsStub.stubs.loadBlocksData.returns(blocks);
  //     generateBytesBlockStub = sandbox.stub().callsFake((b) => b);
  //     (instance as any).pblocksFactory = () => ({
  //       generateBytesBlock: generateBytesBlockStub,
  //     });
  //   });
  //
  //   it('should call loadBlocksData', async () => {
  //     await instance.getBlocks('123');
  //     expect(blocksSubmoduleUtilsStub.stubs.loadBlocksData.calledOnce).to.be.true;
  //     expect(blocksSubmoduleUtilsStub.stubs.loadBlocksData.firstCall.args).to.be.deep.equal([{
  //       lastId: '123',
  //       limit : 2100,
  //     }]);
  //   });
  //
  //   it('should call generateBytesBlock for each block', async () => {
  //     await instance.getBlocks('123');
  //     expect(generateBytesBlockStub.callCount).to.be.equal(blocks.length);
  //     expect(generateBytesBlockStub.args).to.be.deep.equal(blocks.map((b) => [b]));
  //   });
  //
  //   it('should respond with transportBlocks message', async () => {
  //     const resp = await instance.getBlocks('123');
  //     expect(resp).to.be.an.instanceOf(Buffer);
  //     expect(resp.toString()).to.be.eq(JSON.stringify({blocks}));
  //   });
  //
  //   describe('with calculated data', () => {
  //     let findAllTxsStub: SinonStub;
  //     const maxNumberInPayload = 10653;
  //     beforeEach(() => {
  //       numblocksToLoadStub.restore();
  //       findAllTxsStub = sandbox.stub(transactionsModel, 'findAll').resolves([]);
  //       blockLogicStub.stubs.getMinBytesSize.returns(184);
  //       blockLogicStub.stubs.getMaxBytesSize.returns(18000);
  //       transactionLogicStub.stubs.getMaxBytesSize.returns(700);
  //       transactionLogicStub.stubs.getMinBytesSize.returns(219);
  //       transactionLogicStub.stubs.getByteSizeByTxType.returns(219);
  //     });
  //     it('should calculate properly', async () => {
  //       findAllTxsStub.resolves([{type: 0, height: 123457}]);
  //       await instance.getBlocks('123');
  //       const lastHeight = blocksSubmoduleUtilsStub.stubs.loadBlocksData.firstCall.args[0].limit;
  //       expect(lastHeight).eq(maxNumberInPayload - 2); // 1 tx weights more than 1 block
  //     });
  //     it('should return at least 1 block', async () => {
  //       blockLogicStub.stubs.getMinBytesSize.returns(2000000);
  //       findAllTxsStub.resolves([{type: 0, height: 123457}]);
  //       await instance.getBlocks('123');
  //       const lastHeight = blocksSubmoduleUtilsStub.stubs.loadBlocksData.firstCall.args[0].limit;
  //       expect(lastHeight).eq(1);
  //     });
  //   });
  // });
});
