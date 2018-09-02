import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BlocksModule, BlocksModuleChain, BlocksModuleVerify } from '../../src/modules';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { Symbols } from '../../../core-interfaces/src';
import { BlocksSymbols } from '../../src/blocksSymbols';
import { IAccountsModule, IForkModule, ITransactionsModule } from '../../../core-interfaces/src/modules';
import { IBlockLogic, IBlockReward, ITransactionLogic } from '../../../core-interfaces/src/logic';
import { IAccountsModel, IBlocksModel } from '../../../core-interfaces/src/models';
import { ModelSymbols } from '../../../core-models/src/helpers';
import { createFakeBlock } from '../utils/createFakeBlocks';
import { ForkType, SignedBlockType } from '../../../core-types/src';
import { createRandomTransactions, toBufferedTransaction } from '../../../core-transactions/tests/utils/txCrafter';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { VerifyReceipt } from '../../src/hooks';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks/verify', () => {
  let inst: BlocksModuleVerify;
  let container: Container;
  let blocksModule: BlocksModule;
  let blocksChain: BlocksModuleChain;
  // let delegatesModule: DelegatesModuleStub;
  let forkModule: IForkModule;
  let txModule: ITransactionsModule;
  let accountsModule: IAccountsModule;

  let blockLogic: IBlockLogic;
  let blockRewardLogic: IBlockReward;
  let txLogic: ITransactionLogic;

  let blocksModel: typeof IBlocksModel;
  let AccountsModel: typeof IAccountsModel;
  let sandbox: SinonSandbox;

  before(async () => {
    container = await createContainer(['core-blocks', 'core-helpers', 'core', 'core-accounts', 'core-transactions']);
    const b = container.get<BlocksModuleVerify>(BlocksSymbols.modules.verify); // should not throw as it should be included
    await b.cleanup(); // clean up this instance
    container.rebind(BlocksSymbols.modules.verify).to(BlocksModuleVerify); // Force recreation of module at each instance.
  });
  beforeEach(async () => {
    inst      = container.get(BlocksSymbols.modules.verify);

    sandbox        = sinon.createSandbox();
    blocksModule   = container.get(Symbols.modules.blocks);
    blocksChain    = container.get(BlocksSymbols.modules.chain);
    forkModule     = container.get(Symbols.modules.fork);
    txModule       = container.get(Symbols.modules.transactions);
    accountsModule = container.get(Symbols.modules.accounts);

    blockLogic       = container.get(Symbols.logic.block);
    blockRewardLogic = container.get(Symbols.logic.blockReward);
    txLogic          = container.get(Symbols.logic.transaction);

    AccountsModel = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    blocksModel   = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
  });

  afterEach(() => sandbox.restore());

  describe('onNewBlock', () => {
    it('should add blockid to last known block ids [private] (till constants.blockSlotWindow)', async () => {
      const constants = container.get<any>(Symbols.generic.constants);
      for (let i = 0; i < constants.blockSlotWindow * 2; i++) {
        await inst.onNewBlock({ id: `${i}` } as any);
      }
      // all first contants.blockSlotWindow indexes will be removed
      // tslint:disable-next-line: no-string-literal
      expect(inst['lastNBlockIds']).to.be.deep.eq(new Array(constants.blockSlotWindow)
        .fill(null)
        .map((a, idx) => `${constants.blockSlotWindow + idx }`));
    });
  });

  describe('onBlockchainReady', () => {
    it('should initialize [private].lastNBlockIds with the last blockSlotWindow block ids from db', async () => {
      sandbox.stub(blocksModel, 'findAll').resolves([{ id: '1' }, { id: '2' }, { id: '3' }]);
      await inst.onBlockchainReady();
      // tslint:disable-next-line: no-string-literalahusdhuahsud
      expect(inst['lastNBlockIds']).to.be.deep.eq(['1', '2', '3']);
    });
  });

  describe('cleanup', () => {
    it('should return Promise', () => {
      expect(inst.cleanup()).to.be.a.instanceOf(Promise);
    });
  });

  describe('verifyReceipt & verifyBlock', () => {
    let block: SignedBlockType;
    beforeEach(() => {
      const constants        = container.get<any>(Symbols.generic.constants);
      block                  = createFakeBlock(container, {
        previousBlock: { id: '1', height: 100 } as any,
        timestamp    : 101 * constants.blockTime,
      });
      blocksModule.lastBlock = { id: '1', height: 100 } as any;

      // Suppress custom implementations for verifyReceipt & verifyBlock
      // sandbox.stub(inst as any, 'verifyBlockSlotWindow').returns([]);
      sandbox.stub(inst as any, 'verifyBlockAgainstLastIds').returns([]);
      sandbox.stub(inst as any, 'verifyForkOne').returns([]);
      // sandbox.stub(inst as any, 'verifyBlockSlot').returns([]);
    });
    ['verifyReceipt', 'verifyBlock'].forEach((what) => {
      describe(what, () => {
        it('should pass for valid block', async () => {
          const res = await inst[what](block);
          expect(res.verified).is.true;
          expect(res.errors).is.empty;
        });
        it('error if signature is invalid', async () => {
          block.blockSignature = Buffer.from(new Array(64).fill(null).map(() => 'aa').join(''), 'hex');
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
            block.numberOfTransactions = block.numberOfTransactions + 1;

            const res = await inst[what](block);
            expect(res.errors).to.contain('Included transactions do not match block transactions count');
          });
          it('error if transactions.length exceeds maxTxsPerBlock', async () => {
            block.transactions = new Array(100).fill(null);

            const res = await inst[what](block);
            expect(res.errors).to.contain('Number of transactions exceeds maximum per block');
          });
          it('error if duplicate transaction', async () => {
            const txs = createRandomTransactions(10);
            block     = createFakeBlock(container, {
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs.concat([txs[0]]).map((t) => toBufferedTransaction(t)),
            });
            sandbox.stub(txLogic, 'getBytes').returns(Buffer.alloc(10));
            const res = await inst[what](block);
            expect(res.errors).to.contain(`Encountered duplicate transaction: ${txs[0].id}`);
          });
          it('error if tx.getBytes returns error', async () => {

            const txs          = createRandomTransactions(10);
            block              = createFakeBlock(container, {
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs.map((t) => toBufferedTransaction(t)),
            });
            const getBytesStub = sandbox.stub(txLogic, 'getBytes');
            getBytesStub.returns(Buffer.alloc(10));
            getBytesStub.onCall(1).throws(new Error('meow'));

            const res = await inst[what](block);
            expect(res.errors).to.contain('Error: meow');
          });
          it('error if computed payload hex is diff from advertised block.payloadHash', async () => {
            const txs          = createRandomTransactions(10);
            block              = createFakeBlock(container, {
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs.map((t) => toBufferedTransaction(t)),
            });
            const getBytesStub = sandbox.stub(txLogic, 'getBytes');
            getBytesStub.returns(Buffer.alloc(10));
            const res = await inst[what](block);
            expect(res.errors).to.contain('Invalid payload hash');
          });
          it('should return error computed totalAmount differs block.totalAmount', async () => {
            const getBytesStub = sandbox.stub(txLogic, 'getBytes');
            getBytesStub.returns(Buffer.alloc(10));
            const txs         = createRandomTransactions(10);
            block             = createFakeBlock(container, {
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs.map((t) => toBufferedTransaction(t)),
            });
            block.totalAmount = block.totalAmount + 1;
            const res         = await inst[what](block);
            expect(res.errors).to.contain('Invalid total amount');
          });
          it('should return error if computed totalFee differs block.totalFee', async () => {
            const getBytesStub = sandbox.stub(txLogic, 'getBytes');

            getBytesStub.returns(Buffer.alloc(10));
            const txs      = createRandomTransactions(10);
            block          = createFakeBlock(container, {
              previousBlock: { id: '1', height: 100 } as any,
              timestamp    : block.timestamp,
              transactions : txs.map((t) => toBufferedTransaction(t)),
            });
            block.totalFee = block.totalFee + 1;
            const res      = await inst[what](block);
            expect(res.errors).to.contain('Invalid total fee');
          });
        });
      });
    });
  });

  describe('verifyReceipt', () => {
    let block: SignedBlockType;
    beforeEach(() => {
      const constants        = container.get<any>(Symbols.generic.constants);
      block                  = createFakeBlock(container, {
        previousBlock: { id: '1', height: 100 } as any,
        timestamp    : 101 * constants.blockTime,
      });
      blocksModule.lastBlock = { id: '1', height: 100 } as any;
    });
    it('should trigger Filter', async () => {
      const hookSystem = container.get<WordPressHookSystem>(Symbols.generic.hookSystem);
      const stub       = sandbox.stub();

      class Test extends WPHooksSubscriber(Object) {
        public hookSystem = hookSystem;

        @VerifyReceipt()
        public async verifyReceipt(...args: any[]) {
          return stub(...args);
        }
      }

      const t = new Test();
      await t.hookMethods();
      stub.returns('meow');
      expect(await inst.verifyReceipt(block)).eq('meow');
      expect(stub.firstCall.args[0]).deep.eq({ errors: [], verified: true });
      await t.unHook();
    });
    it('error if block is already known between lastBlocks', async () => {
      await inst.onNewBlock(block);
      const res = await inst.verifyReceipt(block);
      expect(res.verified).is.false;
      expect(res.errors).to.contain('Block Already exists in the chain');
    });

  });

  describe('verifyBlock', () => {
    let block: SignedBlockType;
    beforeEach(() => {
      const constants        = container.get<any>(Symbols.generic.constants);
      block                  = createFakeBlock(container, {
        previousBlock: { id: '2', height: 100 } as any,
        timestamp    : 101 * constants.blockTime,
      });
      blocksModule.lastBlock = { id: '1', height: 100 } as any;

    });
    it('should trigger Filter', async () => {
      const hookSystem = container.get<WordPressHookSystem>(Symbols.generic.hookSystem);
      const stub       = sandbox.stub();

      class Test extends WPHooksSubscriber(Object) {
        public hookSystem = hookSystem;

        @VerifyReceipt()
        public async verifyReceipt(...args: any[]) {
          return stub(...args);
        }
      }

      const t = new Test();
      await t.hookMethods();
      stub.returns('meow');
      expect(await inst.verifyReceipt(block)).eq('meow');
      expect(stub.firstCall.args[0]).deep.eq({ errors: [], verified: true });
      await t.unHook();
    });
    it('error if block is in fork 1', async () => {
      const forkStub = sandbox.stub(forkModule, 'fork');
      const res      = await inst.verifyBlock(block);
      expect(res.verified).is.false;
      expect(res.errors).to.contain('Invalid previous block: 2 expected 1');
      expect(forkStub.calledOnce).is.true;
      expect(forkStub.calledWith(block, ForkType.TYPE_1)).is.true;

    });
    // it('error if slotNumber is in the future', async () => {
    //   slots.enqueueResponse('getTime', 0);
    //   slots.stubs.getSlotNumber.onFirstCall().returns(1); // provided block slot
    //   slots.stubs.getSlotNumber.onSecondCall().returns(0); // last block slot
    //   slots.stubs.getSlotNumber.onThirdCall().returns(0); // cur slot
    //   const res = await inst.verifyBlock(block);
    //   expect(res.verified).is.false;
    //   expect(res.errors).to.contain('Invalid block timestamp');
    // });
    // it('error if slotNumber is before lastBlock slot', async () => {
    //   slots.enqueueResponse('getTime', 0);
    //   slots.stubs.getSlotNumber.onFirstCall().returns(1); // provided block slot
    //   slots.stubs.getSlotNumber.onSecondCall().returns(2); // last block slot
    //   slots.stubs.getSlotNumber.onThirdCall().returns(2); // cur slot
    //   const res = await inst.verifyBlock(block);
    //   expect(res.verified).is.false;
    //   expect(res.errors).to.contain('Invalid block timestamp');
    // });
    // it('previsious block is valid(check of Fork type 1)', async () => {
    //   slots.enqueueResponse('getTime', 0);
    //   block.previousBlock = (inst as any).blocksModule.lastBlock.id;
    //   slots.stubs.getSlotNumber.onFirstCall().returns(1); // provided block slot
    //   slots.stubs.getSlotNumber.onSecondCall().returns(2); // last block slot
    //   slots.stubs.getSlotNumber.onThirdCall().returns(2); // cur slot
    //   const res = await inst.verifyBlock(block);
    //   expect(res.verified).is.false;
    //   expect(res.errors).to.be.not.contain('Invalid previous block: 2 expected 1');
    // });
    // it('block timestamp is valid', async () => {
    //   slots.enqueueResponse('getTime', 0);
    //   slots.stubs.getSlotNumber.onFirstCall().returns(1); // provided block slot
    //   slots.stubs.getSlotNumber.onSecondCall().returns(0); // last block slot
    //   slots.stubs.getSlotNumber.onThirdCall().returns(2); // cur slot
    //   const res = await inst.verifyBlock(block);
    //   expect(res.verified).is.false;
    //   expect(res.errors).to.be.not.contain('Invalid block timestamp');
    // });
  });

  describe('processBlock', () => {
    let findByIdStub: SinonStub;
    let resolveAcctsStub: SinonStub;
    let filterConfirmedIDsStub: SinonStub;
    beforeEach(() => {
      findByIdStub     = sandbox.stub(blocksModel, 'findById');
      resolveAcctsStub = sandbox.stub(accountsModule, 'resolveAccountsForTransactions');

      resolveAcctsStub.callsFake((txs) => {
        const toRet = {};
        txs.forEach((tx) => {
          toRet[tx.senderId] = new AccountsModel({ address: tx.senderId });
          if (tx.requesterPublicKey) {
            toRet['address'] = new AccountsModel({ address: 'address' });
          }
        });
        return toRet;
      });
      filterConfirmedIDsStub = sandbox.stub(txModule, 'filterConfirmedIds').resolves([]);
    });
    it('rejects if is cleaning', async () => {
      await inst.cleanup();
      await expect(inst.processBlock(null, true, true))
        .to.be.rejectedWith('Cleaning up');
    });
    it('should verifyBlock after normalization', async () => {
      const stub = sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({
        errors  : ['ERROR'],
        verified: false,
      }));
      sandbox.stub(blockLogic, 'objectNormalize').returns({ id: '1', normalized: 'block' });
      await expect(inst.processBlock(null, true, true))
        .to.be.rejectedWith('ERROR');
      expect(stub.called).is.true;
      expect(stub.firstCall.args[0]).to.be.deep.eq({ id: '1', normalized: 'block' });
    });
    it('should throw if block already exists in db', async () => {
      sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors: [], verified: true }));
      sandbox.stub(blockLogic, 'objectNormalize').returns({ id: '1', normalized: 'block' });
      findByIdStub.resolves({})
      await expect(inst.processBlock(null, true, true))
        .to.be.rejectedWith('Block 1 already exists');
    });
    // it('should throw if delegate.blockSlot is wrong', async () => {
    //   sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors: [], verified: true }));
    //   sandbox.stub(blockLogic, 'objectNormalize').returns({ id: '1', normalized: 'block' });
    //   findByIdStub.resolves(null);
    //   delegatesModule.enqueueResponse('assertValidBlockSlot', Promise.reject('error'));
    //
    //   await expect(inst.processBlock(null, true, true))
    //     .to.be.rejectedWith('error');
    // });
    // it('should fork 3 if delegate.blockSlot is wrong', async () => {
    //   sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors: [], verified: true }));
    //   sandbox.stub(blockLogic, 'objectNormalize').returns({ id: '1', normalized: 'block' });
    //   findByIdStub.resolves(null);
    //   delegatesModule.enqueueResponse('assertValidBlockSlot', Promise.reject('error'));
    //
    //   await expect(inst.processBlock(null, true, true))
    //     .to.be.rejectedWith('error');
    //
    //   expect(forkModule.stubs.fork.calledOnce).is.true;
    //   expect(forkModule.stubs.fork.firstCall.args).is.deep.eq([
    //     { id: '1', normalized: 'block' },
    //     ForkType.WRONG_FORGE_SLOT,
    //   ]);
    // });
    describe('tx checks', () => {
      let txs: Array<ITransaction<any>>;
      let normalizedBlock: any;
      let checkTXStub: SinonStub;
      beforeEach(() => {
        txs = createRandomTransactions(14);
        sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors: [], verified: true }));
        normalizedBlock = { id: '1', normalized: 'block', transactions: txs };
        sandbox.stub(blockLogic, 'objectNormalize').returns(normalizedBlock);
        findByIdStub.resolves(null);
        // delegatesModule.enqueueResponse('assertValidBlockSlot', Promise.resolve());
        sandbox.stub(blocksChain, 'applyBlock').resolves();
        checkTXStub = sandbox.stub(txModule, 'checkTransaction').resolves();
        sandbox.stub(txLogic, 'getId').callsFake((t) => t.id);
        sandbox.stub(txLogic, 'verify').resolves();
        sandbox.stub(txLogic, 'ready').returns(true);
      });
      it('should call txModule.checkTransaction for each tx', async () => {
        checkTXStub.onCall(13).rejects(new Error('meow'));
        await expect(inst.processBlock(null, true, true))
          .rejectedWith('meow');

        // check calls!
        expect(checkTXStub.callCount).eq(10 + 4);
        for (let i = 0; i < txs.length; i++) {
          expect(checkTXStub.getCall(i).args[0]).deep.eq(txs[i]);
        }
      });
      it('should call resolveAccountsForTransactions with all txs in block', async () => {
        await inst.processBlock(null, true, true);
        expect(resolveAcctsStub.callCount).to.be.eq(1);
        expect(resolveAcctsStub.firstCall.args[0]).to.be.eq(txs);
      });
      it('should properly handle tx already confirmed', async () => {
        const unconUnconfirmedStub  = sandbox.stub(txModule, 'undoUnconfirmed').resolves();
        const removeUnconfirmedStub = sandbox.stub(txModule, 'removeUnconfirmedTransaction').onFirstCall().returns(true);
        removeUnconfirmedStub.onSecondCall().returns(false);
        const alreadyConfirmedId1 = normalizedBlock.transactions[1].id;
        const alreadyConfirmedId2 = normalizedBlock.transactions[2].id;
        filterConfirmedIDsStub.resolves([alreadyConfirmedId1, alreadyConfirmedId2]);

        const forkStub = sandbox.stub(forkModule, 'fork').resolves();

        await expect(inst.processBlock(normalizedBlock, true, true)).to.be.rejectedWith('Transactions already confirmed: ' + alreadyConfirmedId1);

        // should send fork
        expect(forkStub.called).is.true;
        expect(forkStub.firstCall.args).is.deep.eq([normalizedBlock, ForkType.TX_ALREADY_CONFIRMED]);

        // shoudl call uncoUnconfirmed and removeUnconfirmed

        expect(removeUnconfirmedStub.calledTwice).is.true;
        expect(unconUnconfirmedStub.calledOnce).is.true;
        expect(unconUnconfirmedStub.firstCall.args[0]).is.deep.eq(normalizedBlock.transactions[1]);

      });
    });

    it('should call blocksChain.applyBlock propagating broadcast,saveblock and accounts values if all ok', async () => {
      sandbox.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors: [], verified: true }));
      sandbox.stub(blockLogic, 'objectNormalize').returns({ id: '1', normalized: 'block', transactions: [] });
      const applyBlockStub = sandbox.stub(blocksChain, 'applyBlock').resolves();
      findByIdStub.resolves(null);
      resolveAcctsStub.resolves({ a: 'b' });
      await inst.processBlock(null, true, false);

      expect(applyBlockStub.calledOnce).is.true;
      expect(applyBlockStub.firstCall.args).is.deep.eq([
        { id: '1', normalized: 'block', transactions: [] },
        true, // broadcast
        false, // saveblock
        { a: 'b' }
      ]);
    });
  });

});
