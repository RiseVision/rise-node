import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { Container } from 'inversify';
import { IBlocksModuleVerify } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { BlocksModuleChain, BlocksModuleVerify } from '../../../../src/modules/blocks/';
import { createContainer } from '../../../utils/containerCreator';
import DbStub from '../../../stubs/helpers/DbStub';
import BlocksModuleStub from '../../../stubs/modules/BlocksModuleStub';
import { BlockLogicStub } from '../../../stubs/logic/BlockLogicStub';
import TransactionLogicStub from '../../../stubs/logic/TransactionLogicStub';
import { DelegatesModuleStub, SlotsStub, TransactionsModuleStub } from '../../../stubs';
import { ForkModuleStub } from '../../../stubs/modules/ForkModuleStub';
import AccountsModuleStub from '../../../stubs/modules/AccountsModuleStub';
import BlockRewardLogicStub from '../../../stubs/logic/BlockRewardLogicStub';
import { BlockLogic, BlockRewardLogic, SignedBlockType } from '../../../../src/logic';
import { createFakeBlock } from '../../../utils/blockCrafter';
import { Ed, Slots } from '../../../../src/helpers';
import { createRandomTransactions } from '../../../utils/txCrafter';

chai.use(chaiAsPromised);
describe('modules/blocks/verify', () => {
  let inst: IBlocksModuleVerify;
  let instReal: BlocksModuleVerify;
  let container: Container;
  beforeEach(() => {
    container = createContainer();
    container.rebind(Symbols.modules.blocksSubModules.verify).to(BlocksModuleVerify);

    inst = instReal = container.get(Symbols.modules.blocksSubModules.verify);
  });

  let blocksModule: BlocksModuleStub;
  let blocksChain: BlocksModuleChain;
  let delegatesModule: DelegatesModuleStub;
  let forkModule: ForkModuleStub;
  let txModule: TransactionsModuleStub;
  let accountsModule: AccountsModuleStub;

  let dbStub: DbStub;

  let slots: SlotsStub;

  let blockLogic: BlockLogicStub;
  let blockRewardLogic: BlockRewardLogicStub;
  let txLogic: TransactionLogicStub;
  beforeEach(() => {
    blocksModule    = container.get(Symbols.modules.blocks);
    blocksChain     = container.get(Symbols.modules.blocksSubModules.chain);
    delegatesModule = container.get(Symbols.modules.delegates);
    forkModule      = container.get(Symbols.modules.fork);
    txModule        = container.get(Symbols.modules.transactions);
    accountsModule  = container.get(Symbols.modules.accounts);

    dbStub = container.get(Symbols.generic.db);

    slots = container.get(Symbols.helpers.slots);

    blockLogic       = container.get(Symbols.logic.block);
    blockRewardLogic = container.get(Symbols.logic.blockReward);
    txLogic          = container.get(Symbols.logic.transaction);
  });

  describe('onNewBlock', () => {
    it('should add blockid to last known block ids [private] (till constants.blockSlotWindow)', async () => {
      const constants = container.get<any>(Symbols.helpers.constants);
      for (let i = 0; i < constants.blockSlotWindow * 2; i++) {
        await instReal.onNewBlock({ id: `${i}` } as any);
      }
      // all first contants.blockSlotWindow indexes will be removed
      expect(instReal['lastNBlockIds']).to.be.deep.eq(new Array(constants.blockSlotWindow)
        .fill(null)
        .map((a, idx) => `${constants.blockSlotWindow + idx }`));
    });
  });

  describe('onBlockchainReady', () => {
    it('should initialize [private].lastNBlockIds with the last blockSlotWindow block ids from db', async () => {
      dbStub.enqueueResponse('query', Promise.resolve([{ id: '1' }, { id: '2' }, { id: '3' }]));
      await instReal.onBlockchainReady();
      expect(instReal['lastNBlockIds']).to.be.deep.eq(['1', '2', '3']);
    });
  });

  describe('cleanup', () => {
    it('should return Promise', () => {
      expect(instReal.cleanup()).to.be.a.instanceOf(Promise);
    });
  });

  describe('verifyReceipt & verifyBlock', () => {
    let block: SignedBlockType;
    beforeEach(() => {
      const constants        = container.get<any>(Symbols.helpers.constants);
      block                  = createFakeBlock({
        timestamp    : 101 * constants.blockTime,
        previousBlock: { id: '1', height: 100 } as any
      });
      blocksModule.lastBlock = { id: '1', height: 100 } as any;
      container.rebind(Symbols.helpers.slots).to(Slots);
      container.rebind(Symbols.logic.block).to(BlockLogic);
      container.rebind(Symbols.logic.blockReward).to(BlockRewardLogic);
      container.rebind(Symbols.helpers.ed).toConstantValue(new Ed());
      inst = instReal = container.get(Symbols.modules.blocksSubModules.verify);

      // Suppress custom implementations for verifyReceipt & verifyBlock
      sinon.stub(inst as any, 'verifyBlockSlotWindow').returns([]);
      sinon.stub(inst as any, 'verifyBlockAgainstLastIds').returns([]);
      sinon.stub(inst as any, 'verifyForkOne').returns([]);
      sinon.stub(inst as any, 'verifyBlockSlot').returns([]);
    });
    ['verifyReceipt', 'verifyBlock'].forEach((what) => {
      describe(what, () => {
        it('should pass for valid block', async () => {
          const res = await inst[what](block);
          expect(res.verified).is.true;
          expect(res.errors).is.empty;
        })
        it('error if signature is invalid', async () => {
          block.blockSignature = new Array(64).fill(null).map(() => 'aa').join('');
          const res            = await inst[what](block);
          expect(res.errors).to.be.deep.eq(['Failed to verify block signature']);
          expect(res.verified).is.false;
        });
        it('error if previousBlock is not set', async () => {
          block.previousBlock = null;
          const res           = await inst[what](block);
          expect(res.errors).to.contain('Invalid previous block');
          expect(res.verified).is.false;
        });
        it('error if version is > 0', async () => {
          block.version = 1;
          const res     = await inst[what](block);
          expect(res.errors).to.contain('Invalid block version');
          expect(res.verified).is.false;
        });
        describe('payload check', () => {
          it('error if payload length is greater than max allowed (1MB)', async () => {
            block.payloadLength = 1024 * 1024 + 1;

            const res = await inst[what](block);
            expect(res.errors).to.contain('Payload length is too long');
          });
          it('error if transactions.length is != than block.numberOftransactions', async () => {
            block.numberOfTransactions = block.numberOfTransactions+1;

            const res = await inst[what](block);
            expect(res.errors).to.contain('Included transactions do not match block transactions count');
          });
          it('error if transactions.length exceeds maxTxsPerBlock', async () => {
            block.transactions = new Array(100).fill(null);

            const res = await inst[what](block);
            expect(res.errors).to.contain('Number of transactions exceeds maximum per block');
          });
          it('error if duplicate transaction', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            const txs = createRandomTransactions({send: 10});
            block                  = createFakeBlock({
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs.concat([txs[0]]),
            });
            const res = await inst[what](block);
            expect(res.errors).to.contain(`Encountered duplicate transaction: ${txs[0].id}`);
          });
          it('error if tx.getBytes returns error', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            txLogic.stubs.getBytes.onCall(1).throws(new Error('meow'));
            const txs = createRandomTransactions({send: 10});
            block                  = createFakeBlock({
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs,
            });
            const res = await inst[what](block);
            expect(res.errors).to.contain(`Error: meow`);
          });
          it('error if computed payload hex is diff from advertised block.payloadHash', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            const txs = createRandomTransactions({send: 10});
            block                  = createFakeBlock({
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs,
            });
            const res = await inst[what](block);
            expect(res.errors).to.contain('Invalid payload hash');
          });
          it('should return error computed totalAmount differs block.totalAmount', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            const txs = createRandomTransactions({send: 10});
            block                  = createFakeBlock({
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs,
            });
            block.totalAmount = block.totalAmount + 1;
            const res = await inst[what](block);
            expect(res.errors).to.contain('Invalid total amount');
          });
          it('should return error if computed totalFee differs block.totalFee', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            const txs = createRandomTransactions({send: 10});
            block                  = createFakeBlock({
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs,
            });
            block.totalFee = block.totalFee + 1;
            const res = await inst[what](block);
            expect(res.errors).to.contain('Invalid total fee');
          });
        });
      });
    });
  });
  describe('verifyReceipt', () => {
    it('error if blockslot is in the past of more than blockSlotWindow');
    it('error if blockslot is in the future');
    it('error if block is already known between lastBlocks');
  });

  describe('verifyBlock', () => {
    it('error if block is in fork 1');
    it('error if slotNumber is in the future');
    it('error if slotNumber is before lastBlock slot');
  });

  describe('processBlock', () => {

  });

});
