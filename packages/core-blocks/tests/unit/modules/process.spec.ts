import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import {
  createRandomTransactions,
  toBufferedTransaction
} from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import {
  IAccountsModel,
  IAccountsModule,
  IBlockLogic,
  IBlocksModule,
  ITransactionLogic,
  ITransactionsModule,
  Symbols
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { BlocksModuleProcess, BlocksModuleVerify, BlocksSymbols } from '../../../src';
import { ModelSymbols } from '@risevision/core-models';
import { LiskWallet } from 'dpos-offline';
import { TransactionPool } from '@risevision/core-transactions';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks/process', () => {
  let txModule: ITransactionsModule;
  let txPool: TransactionPool;
  let accountsModule: IAccountsModule;
  let blocksModule: IBlocksModule;
  let blockVerifyModule: BlocksModuleVerify;
  let blockLogic: IBlockLogic;
  let txLogic: ITransactionLogic;
  let sandbox: SinonSandbox;
  let instance: BlocksModuleProcess;
  let container: Container;
  let AccountsModel: typeof IAccountsModel;
  beforeEach(async () => {
    sandbox           = sinon.createSandbox();
    container         = await createContainer(['core-blocks', 'core-helpers', 'core-crypto', 'core', 'core-accounts', 'core-transactions']);
    accountsModule    = container.get(Symbols.modules.accounts);
    instance          = container.get(BlocksSymbols.modules.process);
    txModule          = container.get(Symbols.modules.transactions);
    txLogic           = container.get(Symbols.logic.transaction);
    txPool            = container.get(Symbols.logic.txpool);
    blocksModule      = container.get(BlocksSymbols.modules.blocks);
    blockVerifyModule = container.get(BlocksSymbols.modules.verify);
    blockLogic        = container.get(BlocksSymbols.logic.block);
    AccountsModel     = container.getNamed(ModelSymbols.model, Symbols.models.accounts);

  });
  afterEach(() => {
    sandbox.restore();
  });

  // describe('getCommonBlock', () => {
  //   let blocksModelCountStub: SinonStub;
  //   beforeEach(() => {
  //     blocksUtils.enqueueResponse('getIdSequence', {ids: ['1', '2', '3', '4', '5']});
  //     blocksModelCountStub = sandbox.stub(blocksModel, 'count').resolves(1);
  //   });
  //   it('should get idSequence first', async () => {
  //     try {
  //       await inst.getCommonBlock(null, 10);
  //     } catch (e) {
  //       return false;
  //     }
  //     expect(blocksUtils.stubs.getIdSequence.called).is.true;
  //     expect(blocksUtils.stubs.getIdSequence.firstCall.args[0]).is.eq(10);
  //   });
  //   it('should call transportModule getFromPeer with proper data', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve());
  //     try {
  //       await inst.getCommonBlock({peer: 'peer'} as any, 10);
  //     } catch (e) {
  //       return false;
  //     }
  //     expect(transportModule.stubs.getFromPeer.called).is.true;
  //     expect(transportModule.stubs.getFromPeer.firstCall.args[0]).to.be.deep.eq({peer: 'peer'});
  //     expect(transportModule.stubs.getFromPeer.firstCall.args[1]).to.be.deep.eq({
  //       api   : '/blocks/common?ids=1,2,3,4,5',
  //       method: 'GET',
  //     });
  //   });
  //   describe('no match with peer (null common)', () => {
  //     beforeEach(() => {
  //       transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {common: null}}));
  //     });
  //     it('should check consensus', async () => {
  //       appState.stubs.getComputed.returns(true);
  //       blocksChain.enqueueResponse('recoverChain', Promise.resolve());
  //       await inst.getCommonBlock({peer: 'peer'} as any, 10);
  //
  //       expect(appState.stubs.getComputed.called).is.true;
  //       expect(appState.stubs.getComputed.firstCall.args[0]).is.eq('node.poorConsensus');
  //     });
  //     it('should call recoverChain if consensus is low', async () => {
  //       appState.stubs.getComputed.returns(true);
  //       blocksChain.enqueueResponse('recoverChain', Promise.resolve());
  //       await inst.getCommonBlock({peer: 'peer'} as any, 10);
  //
  //       expect(blocksChain.stubs.recoverChain.calledOnce).is.true;
  //     });
  //     it('should throw error if consensus is adeguate', async () => {
  //       appState.stubs.getComputed.returns(false);
  //       await expect(inst.getCommonBlock({peer: 'peer'} as any, 10)).to
  //         .be.rejectedWith('Chain comparison failed');
  //     });
  //   });
  //   it('should fail if peer response is not valid', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {common: '1'}}));
  //     schemaStub.enqueueResponse('validate', false);
  //     schemaStub.enqueueResponse('getLastErrors', []);
  //
  //     await expect(inst.getCommonBlock({peer: 'peer'} as any, 10))
  //       .to.be.rejectedWith('Cannot validate commonblock response');
  //   });
  //   it('should check response against db to avoid malicious peers', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({
  //       body: {
  //         common: {
  //           height       : 1,
  //           id           : 'id',
  //           previousBlock: 'pb',
  //         },
  //       },
  //     }));
  //
  //     await inst.getCommonBlock({p: 'p'} as any, 10);
  //     expect(blocksModelCountStub.calledOnce).is.true;
  //     expect(blocksModelCountStub.firstCall.args[0]).deep.eq({
  //       where: {
  //         height       : 1,
  //         id           : 'id',
  //         previousBlock: 'pb',
  //       }
  //     });
  //   });
  //
  //   // tslint:disable-next-line: max-line-length
  //   it('should trigger recoverChain if returned commonblock does not return anything from db and poor consensus', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({
  //       body: {
  //         common: {},
  //       },
  //     }));
  //     blocksModelCountStub.resolves(0);
  //     appState.enqueueResponse('getComputed', true); // poor consensus
  //     blocksChain.enqueueResponse('recoverChain', Promise.resolve());
  //
  //     await inst.getCommonBlock({p: 'p'} as any, 10);
  //     expect(blocksChain.stubs.recoverChain.calledOnce).is.true;
  //     expect(appState.stubs.getComputed.calledOnce).is.true;
  //     expect(appState.stubs.getComputed.firstCall.args[0]).is.eq('node.poorConsensus');
  //
  //   });
  //
  //   // tslint:disable-next-line: max-line-length
  //   it('should throw error if returned common block does not return anything from db and NOT poor consensus', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({
  //       body: {
  //         common: {},
  //       },
  //     }));
  //     blocksModelCountStub.resolves(0);
  //     appState.enqueueResponse('getComputed', false); // poor consensus
  //
  //     await expect(inst.getCommonBlock({p: 'p'} as any, 10)).to.be.rejectedWith('Chain comparison failed with peer');
  //   });
  // });
  //
  // describe('loadBlocksOffset', () => {
  //   let blocksModelFindAllStub: SinonStub;
  //   beforeEach(() => {
  //     blocksModelFindAllStub = sandbox.stub(blocksModel, 'findAll');
  //     inst['TransactionsModel'] = 'txModel'; // avoid recursion on deep equality checks
  //   });
  //   describe('db query', () => {
  //     it('should be done accounting offset>0', async () => {
  //       blocksModelFindAllStub.resolves([]);
  //       blocksUtils.enqueueResponse('readDbRows', []);
  //
  //       await inst.loadBlocksOffset(10, 5, true);
  //       expect(blocksModelFindAllStub.firstCall.args[0]).is.deep.eq({
  //         include: [ 'txModel' ],
  //         order: [ 'height', 'rowId'],
  //         where: {
  //           height: {
  //             // [Op.gte]: 5,
  //             // [Op.lt]: 15,
  //           },
  //         },
  //       });
  //
  //       expect(blocksModelFindAllStub.firstCall.args[0].where.height[Op.gte]).eq(5);
  //       expect(blocksModelFindAllStub.firstCall.args[0].where.height[Op.lt]).eq(15);
  //     });
  //     it('should be done accounting offset=0', async () => {
  //       blocksModelFindAllStub.resolves([]);
  //       blocksUtils.enqueueResponse('readDbRows', []);
  //
  //       await inst.loadBlocksOffset(10, 0, true);
  //       expect(blocksModelFindAllStub.firstCall.args[0]).is.deep.eq({
  //         include: [ 'txModel' ],
  //         order: [ 'height', 'rowId'],
  //         where: {
  //           height: {
  //             // [Op.gte]: 0,
  //             // [Op.lt]: 10,
  //           },
  //         },
  //       });
  //
  //       expect(blocksModelFindAllStub.firstCall.args[0].where.height[Op.gte]).eq(0);
  //       expect(blocksModelFindAllStub.firstCall.args[0].where.height[Op.lt]).eq(10);
  //     });
  //     it('should be done accounting offset=undefined', async () => {
  //       blocksModelFindAllStub.resolves([]);
  //       blocksUtils.enqueueResponse('readDbRows', []);
  //
  //       await inst.loadBlocksOffset(10, undefined, true);
  //       expect(blocksModelFindAllStub.firstCall.args[0]).is.deep.eq({
  //         include: [ 'txModel' ],
  //         order: [ 'height', 'rowId'],
  //         where: {
  //           height: {
  //             // [Op.gte]: 0,
  //             // [Op.lt]: 10,
  //           },
  //         },
  //       });
  //
  //       expect(blocksModelFindAllStub.firstCall.args[0].where.height[Op.gte]).eq(0);
  //       expect(blocksModelFindAllStub.firstCall.args[0].where.height[Op.lt]).eq(10);
  //     });
  //   });
  //
  //   describe('with blocks', () => {
  //     beforeEach(() => {
  //       blocksModelFindAllStub.resolves([{id: '1'}, {id: '2'}]);
  //       blocksChain.enqueueResponse('applyBlock', Promise.resolve());
  //       blocksChain.enqueueResponse('applyBlock', Promise.resolve());
  //       accountsModule.stubs.resolveAccountsForTransactions.resolves({});
  //     });
  //     it('if verify=true it should call blockVerifyModule on each block', async () => {
  //       // 2 blocks
  //       blockVerify.enqueueResponse('verifyBlock', Promise.resolve({verified: true}));
  //       blockVerify.enqueueResponse('verifyBlock', Promise.resolve({verified: true}));
  //       await inst.loadBlocksOffset(10, 0, true);
  //       expect(blockVerify.stubs.verifyBlock.callCount).eq(2);
  //     });
  //     it('if verify=true it should call blockVerify and stop processing if one is not verified', async () => {
  //       blockVerify.enqueueResponse('verifyBlock', Promise.resolve({verified: false, errors: ['ERROR']}));
  //       await expect(inst.loadBlocksOffset(10, 0, true)).to.be.rejectedWith('ERROR');
  //       expect(blockVerify.stubs.verifyBlock.calledOnce).is.true;
  //     });
  //     it('should call applyGenesisBlock if blockid is same as genesis', async () => {
  //       const genesis: SignedAndChainedBlockType = container.get(Symbols.generic.genesisBlock);
  //       blocksUtils.reset();
  //       blocksModelFindAllStub.resolves([genesis]);
  //       blocksChain.enqueueResponse('applyGenesisBlock', Promise.resolve());
  //       await inst.loadBlocksOffset(10, 0, false);
  //       expect(blocksChain.stubs.applyGenesisBlock.calledOnce).is.true;
  //     });
  //     it('should call applyBlock twice', async () => {
  //       await inst.loadBlocksOffset(10, 0, false);
  //       expect(blocksChain.stubs.applyBlock.callCount).is.eq(2);
  //     });
  //     it('should set lastBlock in blocksModule', async () => {
  //       await inst.loadBlocksOffset(10, 0, false);
  //       expect(blocksModule.lastBlock).to.be.deep.eq({id: '2'});
  //     });
  //     it('should return lastBlock', async () => {
  //       expect(await inst.loadBlocksOffset(10, 0, false)).to.be.deep.eq({id: '2'});
  //     });
  //     it('should set lastBlock to last successfully processed even if one fails', async () => {
  //       blocksChain.stubs.applyBlock.onCall(1).rejects();
  //       try {
  //         await inst.loadBlocksOffset(10, 0, false);
  //       } catch (e) {
  //         return false;
  //       }
  //       expect(blocksModule.lastBlock).to.be.deep.eq({id: '1'});
  //     });
  //     it('should return undefined if cleanup', async () => {
  //       await inst.cleanup();
  //       expect(await inst.loadBlocksOffset(10, 0, false)).to.be.undefined;
  //     });
  //   });
  // });
  //
  // describe('loadBlocksFromPeer', () => {
  //   let fakePeer;
  //   beforeEach(() => {
  //     fakePeer = createFakePeer();
  //     peersLogic.enqueueResponse('create', fakePeer);
  //
  //   });
  //   it('should transport.getFromPeer with correct api and method', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {}}));
  //     blocksUtils.enqueueResponse('readDbRows', []);
  //     blocksModule.lastBlock = {id: '1'} as any;
  //     await inst.loadBlocksFromPeer(null);
  //     expect(transportModule.stubs.getFromPeer.calledOnce).is.true;
  //     expect(transportModule.stubs.getFromPeer.firstCall.args[0]).is.deep.eq(fakePeer);
  //     expect(transportModule.stubs.getFromPeer.firstCall.args[1]).is.deep.eq({
  //       api   : '/blocks?lastBlockId=1',
  //       method: 'GET',
  //     });
  //   });
  //   it('should validate response against schema', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {blocks: ['1', '2', '3']}}));
  //     blocksUtils.enqueueResponse('readDbRows', []);
  //     blocksModule.lastBlock = {id: '1'} as any;
  //     schemaStub.enqueueResponse('validate', false);
  //
  //     await expect(inst.loadBlocksFromPeer(null))
  //       .to.rejectedWith('Received invalid blocks data');
  //
  //     expect(schemaStub.stubs.validate.calledOnce).is.true;
  //     expect(schemaStub.stubs.validate.firstCall.args[0]).is.deep.eq(['1', '2', '3']);
  //   });
  //   it('should read returned data through utilsModule', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {blocks: ['1', '2', '3']}}));
  //     blocksUtils.enqueueResponse('readDbRows', []);
  //     blockVerify.stubs.processBlock.resolves();
  //     blocksModule.lastBlock = {id: '1'} as any;
  //
  //     await inst.loadBlocksFromPeer(null);
  //
  //     expect(blocksUtils.stubs.readDbRows.calledOnce).is.true;
  //     expect(blocksUtils.stubs.readDbRows.firstCall.args[0]).is.deep.eq(['1', '2', '3']);
  //   });
  //   it('should call processBlock on each block', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {blocks: []}}));
  //     blocksUtils.enqueueResponse('readDbRows', ['1', '2', '3']);
  //     blockVerify.stubs.processBlock.resolves();
  //     blocksModule.lastBlock = {id: '1'} as any;
  //
  //     await inst.loadBlocksFromPeer(null);
  //     expect(blockVerify.stubs.processBlock.callCount).is.eq(3);
  //     expect(blockVerify.stubs.processBlock.getCall(0).args[0]).to.be.deep.eq('1');
  //     expect(blockVerify.stubs.processBlock.getCall(1).args[0]).to.be.deep.eq('2');
  //     expect(blockVerify.stubs.processBlock.getCall(2).args[0]).to.be.deep.eq('3');
  //     expect(blockVerify.stubs.processBlock.getCall(0).args[1]).to.be.deep.eq(false);
  //     expect(blockVerify.stubs.processBlock.getCall(0).args[2]).to.be.deep.eq(true);
  //   });
  //   it('should throw if one processBlock fails', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {blocks: []}}));
  //     blocksUtils.enqueueResponse('readDbRows', ['1', '2', '3']);
  //     blockVerify.stubs.processBlock.resolves();
  //     blockVerify.stubs.processBlock.onCall(2).rejects();
  //     blocksModule.lastBlock = {id: '1'} as any;
  //
  //     await expect(inst.loadBlocksFromPeer(null)).to.be.rejected;
  //     expect(blockVerify.stubs.processBlock.callCount).is.eq(3);
  //
  //   });
  //   it('should return the last validBlock', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {blocks: []}}));
  //     blocksUtils.enqueueResponse('readDbRows', ['1', '2', '3']);
  //     blockVerify.stubs.processBlock.resolves();
  //     blocksModule.lastBlock = {id: '1'} as any;
  //
  //     expect(await inst.loadBlocksFromPeer(null)).to.be.eq('3');
  //   });
  //   it('should not process anything if is cleaning', async () => {
  //     transportModule.enqueueResponse('getFromPeer', Promise.resolve({body: {blocks: []}}));
  //     blocksUtils.enqueueResponse('readDbRows', ['1', '2', '3']);
  //     blockVerify.stubs.processBlock.resolves();
  //     blocksModule.lastBlock  = {id: '1'} as any;
  //     await inst.cleanup();
  //
  //     expect(await inst.loadBlocksFromPeer(null)).to.be.deep.eq({id: '1'});
  //     expect(blockVerify.stubs.processBlock.called).is.false;
  //   });
  //
  // });
  //
  describe('generateBlock', () => {
    let txs;
    let stubs = {
      amGettAccount             : null as SinonStub,
      txModuleFilterConfirmedIds: null as SinonStub,
    };
    beforeEach(() => {
      txs                              = createRandomTransactions(10);
      stubs.txModuleFilterConfirmedIds = sandbox
        .stub(txModule, 'filterConfirmedIds').resolves([txs[0].id, txs[2].id]);
      stubs.amGettAccount              = sandbox
        .stub(accountsModule, 'getAccount').callsFake((what) => Promise.resolve(new AccountsModel(what)));
    });
    it('should use blockLogic.create with the proper data and post result to verify.processBlock', async () => {
      blocksModule.lastBlock = { height: 10, id: '11' } as any;
      const createSpy        = sandbox.spy(blockLogic, 'create');
      const wallet           = new LiskWallet('meow', 'R');
      const keypair          = {
        privateKey: Buffer.from(wallet.privKey, 'hex'),
        publicKey : Buffer.from(wallet.publicKey, 'hex'),
      };
      const r                = await instance.generateBlock(keypair, 10);

      expect(createSpy.called).is.true;
      expect(createSpy.firstCall.args[0])
        .deep.eq({
        keypair,
        previousBlock: { height: 10, id: '11' },
        timestamp    : 10,
        transactions : [],
      });

      expect(r).deep.eq(createSpy.firstCall.returnValue);
      //
      // expect(stubs.processBlockStub.calledOnce).is.true;
      // expect(stubs.processBlockStub.firstCall.args[0]).deep.eq(createSpy.firstCall.returnValue);
      // expect(stubs.processBlockStub.firstCall.args[1]).deep.eq(true /*broadcast*/);
      // expect(stubs.processBlockStub.firstCall.args[2]).deep.eq(true /*save the block in db */);
    });
    it('should filter transactions by verifying them', async () => {
      blocksModule.lastBlock = { height: 10, id: '11' } as any;
      const txs              = createRandomTransactions(3).map((t) => toBufferedTransaction(t));
      txs.forEach((t) => txPool.unconfirmed.add(t, { receivedAt: new Date() }));

      const stub = sandbox.stub(txLogic, 'verify').resolves();
      stub.onCall(2).rejects();
      const createSpy = sandbox.spy(blockLogic, 'create');

      const wallet  = new LiskWallet('meow', 'R');
      const keypair = {
        privateKey: Buffer.from(wallet.privKey, 'hex'),
        publicKey : Buffer.from(wallet.publicKey, 'hex'),
      };
      await instance.generateBlock(keypair, 10);

      expect(createSpy.firstCall.args[0].transactions.length).eq(2);
      expect(createSpy.firstCall.args[0].transactions).deep.eq([txs[0], txs[1]]);
    });
    it('should filter transactions that are not ready', async () => {
      blocksModule.lastBlock = { height: 10, id: '11' } as any;
      const txs              = createRandomTransactions(3).map((t) => toBufferedTransaction(t));
      txs.forEach((t) => txPool.unconfirmed.add(t, { receivedAt: new Date() }));

      const stub = sandbox.stub(txLogic, 'ready').resolves(true);
      sandbox.stub(txLogic, 'verify').resolves(true);
      stub.onCall(2).resolves(false);
      const createSpy = sandbox.spy(blockLogic, 'create');

      const wallet  = new LiskWallet('meow', 'R');
      const keypair = {
        privateKey: Buffer.from(wallet.privKey, 'hex'),
        publicKey : Buffer.from(wallet.publicKey, 'hex'),
      };
      await instance.generateBlock(keypair, 10);

      expect(createSpy.firstCall.args[0].transactions.length).eq(2);
      expect(createSpy.firstCall.args[0].transactions).deep.eq([txs[0], txs[1]]);
    });
  });
  //
  // describe('onReceiveBlock', () => {
  //   it('should return and do nothing if loader.isSyncing', async () => {
  //     appState.stubs.get.callsFake((what) => {
  //       return (what === 'loader.isSyncing');
  //     });
  //     await inst.onReceiveBlock({id: '1'} as any);
  //     expect(appState.stubs.get.calledWith('loader.isSyncing')).is.true;
  //   });
  //   it('should return and do nothing if loader.isTicking', async () => {
  //     appState.stubs.get.callsFake((what) => {
  //       return (what === 'rounds.isTicking');
  //     });
  //     await inst.onReceiveBlock({id: '1'} as any);
  //     expect(appState.stubs.get.calledWith('rounds.isTicking')).is.true;
  //   });
  //   describe('all ok', () => {
  //     const block = {previousBlock: '1', height: 11} as any;
  //     beforeEach(() => {
  //       blocksModule.lastBlock = {id: '1', height: 10} as any;
  //       appState.stubs.get.returns(false);
  //       roundsStub.stubs.calcRound.returns('');
  //       blockVerify.enqueueResponse('processBlock', Promise.resolve());
  //     });
  //     it('should update lastReceipt', async () => {
  //       await inst.onReceiveBlock(block);
  //       expect(blocksModule.spies.lastReceipt.update.called).is.true;
  //     });
  //     it('should verify.processBlock with broadcast=true and saveBlock=true', async () => {
  //       await inst.onReceiveBlock(block);
  //       expect(blockVerify.stubs.processBlock.called).is.true;
  //       expect(blockVerify.stubs.processBlock.firstCall.args[0]).is.deep.eq(block);
  //       expect(blockVerify.stubs.processBlock.firstCall.args[1]).is.deep.eq(true);
  //       expect(blockVerify.stubs.processBlock.firstCall.args[2]).is.deep.eq(true);
  //
  //     });
  //   });
  //   describe('fork 1 if consequent blocks but diff prevblock', () => {
  //     let block: any;
  //     beforeEach(() => {
  //       block                  = {previousBlock: '3', height: 11, timestamp: 2} as any;
  //       blocksModule.lastBlock = {id: '1', height: 10, timestamp: 1} as any;
  //       fork.enqueueResponse('fork', Promise.resolve());
  //       appState.stubs.get.returns(false);
  //       blockLogic.enqueueResponse('objectNormalize', {after: 'normalization'});
  //       delegates.enqueueResponse('assertValidBlockSlot', Promise.resolve());
  //       blockVerify.enqueueResponse('verifyReceipt', {verified: true});
  //       blocksChain.enqueueResponse('deleteLastBlock', Promise.resolve());
  //       blocksChain.enqueueResponse('deleteLastBlock', Promise.resolve());
  //     });
  //     it('should call forkModule.fork with ForkType.TYPE_1', async () => {
  //       await inst.onReceiveBlock(block);
  //       expect(fork.stubs.fork.calledOnce).is.true;
  //     });
  //     it('should go through verification if timestamp is < than last known', async () => {
  //       block.timestamp                  = 1;
  //       blocksModule.lastBlock.timestamp = 2;
  //       await inst.onReceiveBlock(block);
  //       expect(blockVerify.stubs.verifyReceipt.called).is.true;
  //       // should be called with normalization output
  //       expect(blockVerify.stubs.verifyReceipt.firstCall.args[0]).is.deep.eq({after: 'normalization'});
  //     });
  //     it('should go through verification if timestamp == last known but blockid < last known', async () => {
  //       block.timestamp                  = 1;
  //       blocksModule.lastBlock.timestamp = 1;
  //       block.id                         = '1';
  //       blocksModule.lastBlock.id        = '2';
  //       await inst.onReceiveBlock(block);
  //       expect(blockVerify.stubs.verifyReceipt.called).is.true;
  //     });
  //     it('should not delete lastBlock if verifyReceipt fails', async () => {
  //       block.timestamp                  = 1;
  //       blocksModule.lastBlock.timestamp = 2;
  //       blockVerify.stubs.verifyReceipt.returns({verified: false, errors: ['ERROR']});
  //       try {
  //         await inst.onReceiveBlock(block);
  //       } catch (e) {
  //         expect(e.message).to.be.eq('ERROR');
  //       }
  //       expect(blocksChain.stubs.deleteLastBlock.called).is.false;
  //
  //     });
  //     it('should call deleteLastBlock twice if verification goes through', async () => {
  //       block.timestamp                  = 1;
  //       blocksModule.lastBlock.timestamp = 2;
  //       await inst.onReceiveBlock(block);
  //       expect(blocksChain.stubs.deleteLastBlock.callCount).is.eq(2);
  //     });
  //   });
  //
  //   describe('fork 5 if same prevblock and height but different blockid', () => {
  //     let block: any;
  //     beforeEach(() => {
  //       block                  = {id: '2', previousBlock: '3', height: 11, timestamp: 1} as any;
  //       blocksModule.lastBlock = {id: '1', previousBlock: '3', height: 11, timestamp: 1} as any;
  //       fork.enqueueResponse('fork', Promise.resolve());
  //       appState.stubs.get.returns(false);
  //       blockLogic.enqueueResponse('objectNormalize', {after: 'normalization'});
  //       delegates.enqueueResponse('assertValidBlockSlot', Promise.resolve());
  //       blockVerify.enqueueResponse('verifyReceipt', {verified: true});
  //       blocksChain.enqueueResponse('deleteLastBlock', Promise.resolve());
  //       blocksChain.enqueueResponse('deleteLastBlock', Promise.resolve());
  //
  //       roundsStub.enqueueResponse('calcRound', '1');
  //       blockVerify.enqueueResponse('processBlock', Promise.resolve());
  //
  //     });
  //     it('should call forkModule.fork with ForkType.TYPE_5', async () => {
  //       await inst.onReceiveBlock(block);
  //       expect(fork.stubs.fork.called).is.true;
  //       expect(fork.stubs.fork.firstCall.args[0]).is.deep.eq(block);
  //       expect(fork.stubs.fork.firstCall.args[1]).is.deep.eq(ForkType.TYPE_5);
  //     });
  //     it('should go thorough verification if received block has lower timestamp (older)', async () => {
  //       block.timestamp                  = 0;
  //       blocksModule.lastBlock.timestamp = 1;
  //       await inst.onReceiveBlock(block);
  //       expect(blockVerify.stubs.verifyReceipt.called).is.true;
  //     });
  //     it('should go thorough verification if same timestamp but received block has lower id', async () => {
  //       block.timestamp                  = 1;
  //       blocksModule.lastBlock.timestamp = 1;
  //       block.id                         = '1';
  //       blocksModule.lastBlock.id        = '2';
  //       await inst.onReceiveBlock(block);
  //       expect(blockVerify.stubs.verifyReceipt.called).is.true;
  //     });
  //     it('should throw error if verifyReceipt fails', async () => {
  //       block.timestamp                  = 0;
  //       blocksModule.lastBlock.timestamp = 1;
  //       blockVerify.stubs.verifyReceipt.returns({verified: false, errors: ['ERROR']});
  //       await expect(inst.onReceiveBlock(block)).to.be.rejectedWith('ERROR');
  //     });
  //     it('should deleteLastBlock if verifyReceipt suceeds', async () => {
  //       block.timestamp                  = 0;
  //       blocksModule.lastBlock.timestamp = 1;
  //       await inst.onReceiveBlock(block);
  //       expect(blocksChain.stubs.deleteLastBlock.callCount).is.eq(1);
  //     });
  //     it('should update blocksModule receipt if verifyReceipt suceeds', async () => {
  //       block.timestamp                  = 0;
  //       blocksModule.lastBlock.timestamp = 1;
  //       await inst.onReceiveBlock(block);
  //       expect(blocksModule.spies.lastReceipt.update.called).is.true;
  //     });
  //     // tslint:disable-next-line: max-line-length
  //     it('should call verifyModule.processBlock with new block and broadcast=true, saveBlock=true if all good', async () => {
  //       block.timestamp                  = 0;
  //       blocksModule.lastBlock.timestamp = 1;
  //       await inst.onReceiveBlock(block);
  //       expect(blockVerify.stubs.processBlock.called).is.true;
  //       expect(blockVerify.stubs.processBlock.firstCall.args[0]).to.be.deep.eq(block);
  //       expect(blockVerify.stubs.processBlock.firstCall.args[1]).to.be.deep.eq(true);
  //       expect(blockVerify.stubs.processBlock.firstCall.args[2]).to.be.deep.eq(true);
  //     });
  //   });
  //
  //   it('Block already processed where block.id === lastBlock.id', async () => {
  //     blocksModule.lastBlock = {id: '1', height: 10, timestamp: 1} as any;
  //     appState.stubs.get.returns(false);
  //     await inst.onReceiveBlock({id: '1'} as any);
  //     expect(loggerStub.stubs.debug.calledOnce).to.be.true;
  //     expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Block already processed');
  //     expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.equal('1');
  //   });
  //   it('should call logger.warn if discarded block that does not match with current chain', async () => {
  //     const roundsLogic: RoundsLogicStub = container.get(Symbols.logic.rounds);
  //     roundsLogic.enqueueResponse('calcRound', 'round');
  //     blocksModule.lastBlock = {id: '12', height: 10, timestamp: 1} as any;
  //     appState.stubs.get.returns(false);
  //     await expect(inst.onReceiveBlock({id: '1'} as any)).be.rejectedWith('Block discarded - not in current chain');
  //     expect(loggerStub.stubs.warn.calledOnce).to.be.true;
  //     // tslint:disable-next-line: max-line-length
  //     expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal('Discarded block that does not match with current chain: 1 height:  round: round slot: 1 generator: ');
  //   });
  // });

});
