import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Ed, ForkType, Slots } from '../../../../src/helpers';
import { IBlocksModuleVerify } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { BlockLogic, BlockRewardLogic, SignedBlockType } from '../../../../src/logic';
import { BlocksModuleVerify } from '../../../../src/modules/blocks/';
import { BlocksSubmoduleChainStub, DelegatesModuleStub, SlotsStub, TransactionsModuleStub } from '../../../stubs';
import { BlockLogicStub } from '../../../stubs/logic/BlockLogicStub';
import BlockRewardLogicStub from '../../../stubs/logic/BlockRewardLogicStub';
import TransactionLogicStub from '../../../stubs/logic/TransactionLogicStub';
import AccountsModuleStub from '../../../stubs/modules/AccountsModuleStub';
import BlocksModuleStub from '../../../stubs/modules/BlocksModuleStub';
import { ForkModuleStub } from '../../../stubs/modules/ForkModuleStub';
import { createContainer } from '../../../utils/containerCreator';

import { createFakeBlock } from '../../../utils/blockCrafter';
import { createRandomTransactions, toBufferedTransaction } from '../../../utils/txCrafter';
import { AccountsModel, BlocksModel } from '../../../../src/models';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
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
  let blocksChain: BlocksSubmoduleChainStub;
  let delegatesModule: DelegatesModuleStub;
  let forkModule: ForkModuleStub;
  let txModule: TransactionsModuleStub;
  let accountsModule: AccountsModuleStub;

  let slots: SlotsStub;

  let blockLogic: BlockLogicStub;
  let blockRewardLogic: BlockRewardLogicStub;
  let txLogic: TransactionLogicStub;

  let blocksModel: typeof BlocksModel;
  let sandbox: SinonSandbox;
  beforeEach(() => {
    blocksModule    = container.get(Symbols.modules.blocks);
    blocksChain     = container.get(Symbols.modules.blocksSubModules.chain);
    delegatesModule = container.get(Symbols.modules.delegates);
    forkModule      = container.get(Symbols.modules.fork);
    txModule        = container.get(Symbols.modules.transactions);
    accountsModule  = container.get(Symbols.modules.accounts);


    slots = container.get(Symbols.helpers.slots);

    blockLogic       = container.get(Symbols.logic.block);
    blockRewardLogic = container.get(Symbols.logic.blockReward);
    txLogic          = container.get(Symbols.logic.transaction);

    blocksModel = container.get(Symbols.models.blocks);
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  describe('onNewBlock', () => {
    it('should add blockid to last known block ids [private] (till constants.blockSlotWindow)', async () => {
      const constants = container.get<any>(Symbols.helpers.constants);
      for (let i = 0; i < constants.blockSlotWindow * 2; i++) {
        await instReal.onNewBlock({id: `${i}`} as any);
      }
      // all first contants.blockSlotWindow indexes will be removed
      // tslint:disable-next-line: no-string-literal
      expect(instReal['lastNBlockIds']).to.be.deep.eq(new Array(constants.blockSlotWindow)
        .fill(null)
        .map((a, idx) => `${constants.blockSlotWindow + idx }`));
    });
  });

  describe('onBlockchainReady', () => {
    it('should initialize [private].lastNBlockIds with the last blockSlotWindow block ids from db', async () => {
      sandbox.stub(blocksModel, 'findAll').resolves([{id: '1'}, {id: '2'}, {id: '3'}]);
      await instReal.onBlockchainReady();
      // tslint:disable-next-line: no-string-literalahusdhuahsud
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
        previousBlock: {id: '1', height: 100} as any,
        timestamp    : 101 * constants.blockTime,
      });
      blocksModule.lastBlock = {id: '1', height: 100} as any;
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
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            const txs = createRandomTransactions({send: 10});
            block     = createFakeBlock({
              previousBlock: {id: '1', height: 100} as any,
              timestamp    : block.timestamp,
              transactions : txs.concat([txs[0]]).map((t) => toBufferedTransaction(t)),
            });
            const res = await inst[what](block);
            expect(res.errors).to.contain(`Encountered duplicate transaction: ${txs[0].id}`);
          });
          it('error if tx.getBytes returns error', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            txLogic.stubs.getBytes.onCall(1).throws(new Error('meow'));
            const txs = createRandomTransactions({send: 10});
            block     = createFakeBlock({
              previousBlock: {id: '1', height: 100} as any,
              timestamp    : block.timestamp,
              transactions : txs.map((t) => toBufferedTransaction(t)),
            });
            const res = await inst[what](block);
            expect(res.errors).to.contain('Error: meow');
          });
          it('error if computed payload hex is diff from advertised block.payloadHash', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            const txs = createRandomTransactions({send: 10});
            block     = createFakeBlock({
              previousBlock: {id: '1', height: 100} as any,
              timestamp    : block.timestamp,
              transactions : txs.map((t) => toBufferedTransaction(t)),
            });
            const res = await inst[what](block);
            expect(res.errors).to.contain('Invalid payload hash');
          });
          it('should return error computed totalAmount differs block.totalAmount', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            const txs         = createRandomTransactions({send: 10});
            block             = createFakeBlock({
              previousBlock: {id: '1', height: 100} as any,
              timestamp    : block.timestamp,
              transactions : txs.map((t) => toBufferedTransaction(t)),
            });
            block.totalAmount = block.totalAmount + 1;
            const res         = await inst[what](block);
            expect(res.errors).to.contain('Invalid total amount');
          });
          it('should return error if computed totalFee differs block.totalFee', async () => {
            txLogic.stubs.getBytes.returns(Buffer.alloc(10));
            const txs      = createRandomTransactions({send: 10});
            block          = createFakeBlock({
              previousBlock: {id: '1', height: 100} as any,
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
      const constants        = container.get<any>(Symbols.helpers.constants);
      block                  = createFakeBlock({
        previousBlock: {id: '1', height: 100} as any,
        timestamp    : 101 * constants.blockTime,
      });
      blocksModule.lastBlock = {id: '1', height: 100} as any;
    });
    it('error if blockslot is in the past of more than blockSlotWindow', () => {
      const constants = container.get<any>(Symbols.helpers.constants);
      slots.stubs.getSlotNumber.onFirstCall().returns(100);
      slots.stubs.getSlotNumber.onSecondCall().returns(100 - constants.blockSlotWindow - 1);
      const res = inst.verifyReceipt(block);
      expect(res.verified).is.false;
      expect(res.errors).to.contain('Block slot is too old');
    });
    it('error if blockslot is in the future', () => {
      slots.stubs.getSlotNumber.onFirstCall().returns(100);
      slots.stubs.getSlotNumber.onSecondCall().returns(101);
      const res = inst.verifyReceipt(block);
      expect(res.verified).is.false;
      expect(res.errors).to.contain('Block slot is in the future');
    });
    it('error if block is already known between lastBlocks', async () => {
      await instReal.onNewBlock(block);
      const res = inst.verifyReceipt(block);
      expect(res.verified).is.false;
      expect(res.errors).to.contain('Block Already exists in the chain');
    });
  });

  describe('verifyBlock', () => {
    let block: SignedBlockType;
    beforeEach(() => {
      const constants        = container.get<any>(Symbols.helpers.constants);
      block                  = createFakeBlock({
        previousBlock: {id: '2', height: 100} as any,
        timestamp    : 101 * constants.blockTime,
      });
      blocksModule.lastBlock = {id: '1', height: 100} as any;

    });
    it('error if block is in fork 1', async () => {
      slots.enqueueResponse('getTime', 0);
      const res = await inst.verifyBlock(block);
      expect(res.verified).is.false;
      expect(res.errors).to.contain('Invalid previous block: 2 expected 1');

    });
    it('error if slotNumber is in the future', async () => {
      slots.enqueueResponse('getTime', 0);
      slots.stubs.getSlotNumber.onFirstCall().returns(1); // provided block slot
      slots.stubs.getSlotNumber.onSecondCall().returns(0); // last block slot
      slots.stubs.getSlotNumber.onThirdCall().returns(0); // cur slot
      const res = await inst.verifyBlock(block);
      expect(res.verified).is.false;
      expect(res.errors).to.contain('Invalid block timestamp');
    });
    it('error if slotNumber is before lastBlock slot', async () => {
      slots.enqueueResponse('getTime', 0);
      slots.stubs.getSlotNumber.onFirstCall().returns(1); // provided block slot
      slots.stubs.getSlotNumber.onSecondCall().returns(2); // last block slot
      slots.stubs.getSlotNumber.onThirdCall().returns(2); // cur slot
      const res = await inst.verifyBlock(block);
      expect(res.verified).is.false;
      expect(res.errors).to.contain('Invalid block timestamp');
    });
    it('previsious block is valid(check of Fork type 1)', async () => {
      slots.enqueueResponse('getTime', 0);
      block.previousBlock = (inst as any).blocksModule.lastBlock.id;
      slots.stubs.getSlotNumber.onFirstCall().returns(1); // provided block slot
      slots.stubs.getSlotNumber.onSecondCall().returns(2); // last block slot
      slots.stubs.getSlotNumber.onThirdCall().returns(2); // cur slot
      const res = await inst.verifyBlock(block);
      expect(res.verified).is.false;
      expect(res.errors).to.be.not.contain('Invalid previous block: 2 expected 1');
    });
    it('block timestamp is valid', async () => {
      slots.enqueueResponse('getTime', 0);
      slots.stubs.getSlotNumber.onFirstCall().returns(1); // provided block slot
      slots.stubs.getSlotNumber.onSecondCall().returns(0); // last block slot
      slots.stubs.getSlotNumber.onThirdCall().returns(2); // cur slot
      const res = await inst.verifyBlock(block);
      expect(res.verified).is.false;
      expect(res.errors).to.be.not.contain('Invalid block timestamp');
    });
  });

  describe('processBlock', () => {
    let findByIdStub: SinonStub;
    beforeEach(() => {
      findByIdStub = sandbox.stub(blocksModel, 'findById');
      accountsModule.enqueueResponse('generateAddressByPublicKey', 'address');
      accountsModule.stubs.resolveAccountsForTransactions.callsFake((txs) => {
        const toRet = {};
        txs.forEach((tx) => {
          toRet[tx.senderId] = new AccountsModel({address: tx.senderId});
          if (tx.requesterPublicKey) {
            toRet['address'] = new AccountsModel({address: 'address'});
          }
        });
        return toRet;
      });
      txModule.stubs.filterConfirmedIds.resolves([]);
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
      blockLogic.enqueueResponse('objectNormalize', {id: '1', normalized: 'block'});
      await expect(inst.processBlock(null, true, true))
        .to.be.rejectedWith('ERROR');
      expect(stub.called).is.true;
      expect(stub.firstCall.args[0]).to.be.deep.eq({id: '1', normalized: 'block'});
    });
    it('should throw if block already exists in db', async () => {
      sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors  : [], verified: true }));
      blockLogic.enqueueResponse('objectNormalize', {id: '1', normalized: 'block'});
      findByIdStub.resolves({})
      await expect(inst.processBlock(null, true, true))
        .to.be.rejectedWith('Block 1 already exists');
    });
    it('should throw if delegate.blockSlot is wrong', async () => {
      sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors  : [], verified: true }));
      blockLogic.enqueueResponse('objectNormalize', {id: '1', normalized: 'block'});
      findByIdStub.resolves(null);
      delegatesModule.enqueueResponse('assertValidBlockSlot', Promise.reject('error'));

      await expect(inst.processBlock(null, true, true))
        .to.be.rejectedWith('error');
    });
    it('should fork 3 if delegate.blockSlot is wrong', async () => {
      sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors  : [], verified: true }));
      blockLogic.enqueueResponse('objectNormalize', {id: '1', normalized: 'block'});
      findByIdStub.resolves(null);
      delegatesModule.enqueueResponse('assertValidBlockSlot', Promise.reject('error'));

      await expect(inst.processBlock(null, true, true))
        .to.be.rejectedWith('error');

      expect(forkModule.stubs.fork.calledOnce).is.true;
      expect(forkModule.stubs.fork.firstCall.args).is.deep.eq([
        { id: '1', normalized: 'block'},
        ForkType.WRONG_FORGE_SLOT,
      ]);
    });
    describe('tx checks', () => {
      let txs: Array<ITransaction<any>>;
      let normalizedBlock: any;
      beforeEach(() => {
        txs = createRandomTransactions({send: 10, vote: 4});
        sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors  : [], verified: true }));
        normalizedBlock = {id: '1', normalized: 'block', transactions: txs};
        blockLogic.enqueueResponse('objectNormalize', normalizedBlock);
        findByIdStub.resolves(null);
        delegatesModule.enqueueResponse('assertValidBlockSlot', Promise.resolve());
        blocksChain.enqueueResponse('applyBlock', Promise.resolve());

        txLogic.stubs.getId.callsFake((t) => t.id);
        txLogic.stubs.verify.resolves();
        txLogic.stubs.ready.returns(true);
      });
      it('should call ready for each tx and throw if one of them is not (ready)', async () => {
        txLogic.stubs.ready.onCall(13).returns(false);
        await expect(inst.processBlock(null, true, true))
          .rejectedWith(`Transaction ${txs[13].id} is not ready`);

        // check calls!
        expect(txLogic.stubs.ready.callCount).eq(10 + 4);
        for (let i = 0; i < txs.length; i++) {
          expect(txLogic.stubs.ready.getCall(i).args[0]).deep.eq(txs[i]);
          expect(txLogic.stubs.ready.getCall(i).args[1].address).deep.eq(txs[i].senderId);
        }
      });
      it('should call resolveAccountsForTransactions with all txs in block', async () => {
        await inst.processBlock(null, true, true);
        expect(accountsModule.stubs.resolveAccountsForTransactions.callCount).to.be.eq(1);
        expect(accountsModule.stubs.resolveAccountsForTransactions.firstCall.args[0]).to.be.eq(txs);
      });
      it('should call verify on each tx', async () => {
        await inst.processBlock(null, true, true);
        expect(txLogic.stubs.verify.callCount).to.be.eq(txs.length);
        for (let i = 0; i < txs.length; i++) {
          expect(txLogic.stubs.verify.getCall(i).args[0]).to.be.deep.eq(txs[i]);
          expect(txLogic.stubs.verify.getCall(i).args[1]).to.be.deep.eq(accountsModule.stubs.resolveAccountsForTransactions.getCall(0).returnValue[(txs[i] as any).senderId]);
          expect(txLogic.stubs.verify.getCall(i).args[2]).to.be.deep.eq(null); // requester account
          expect(txLogic.stubs.verify.getCall(i).args[3]).to.be.deep.eq(undefined); // Block height
        }
      });
      it('should properly handle tx already confirmed', async () => {
        txModule.stubs.undoUnconfirmed.resolves();
        txModule.stubs.removeUnconfirmedTransaction.onFirstCall().returns(true);
        txModule.stubs.removeUnconfirmedTransaction.onSecondCall().returns(false);
        const alreadyConfirmedId1 = normalizedBlock.transactions[1].id;
        const alreadyConfirmedId2 = normalizedBlock.transactions[2].id;
        txModule.stubs.filterConfirmedIds.resolves([alreadyConfirmedId1, alreadyConfirmedId2]);
        await expect(inst.processBlock(normalizedBlock, true, true)).to.be.rejectedWith('Transactions already confirmed: ' + alreadyConfirmedId1);

        // should send fork
        expect(forkModule.stubs.fork.called).is.true;
        expect(forkModule.stubs.fork.firstCall.args).is.deep.eq([normalizedBlock, ForkType.TX_ALREADY_CONFIRMED]);

        // shoudl call uncoUnconfirmed and removeUnconfirmed

        expect(txModule.stubs.removeUnconfirmedTransaction.calledTwice).is.true;
        expect(txModule.stubs.undoUnconfirmed.calledOnce).is.true;
        expect(txModule.stubs.undoUnconfirmed.firstCall.args[0]).is.deep.eq(normalizedBlock.transactions[1]);

      });
      it('should get requesterPublicKey account and pass it to verify if tx has it', async () => {
        txs[0].requesterPublicKey = 'abc';
        await inst.processBlock(null, true, true);
        expect(txLogic.stubs.verify.firstCall.args[0]).to.be.deep.eq(txs[0]);
        expect(txLogic.stubs.verify.firstCall.args[1]).to.be.deep.eq(accountsModule.stubs.resolveAccountsForTransactions.getCall(0).returnValue[(txs[0] as any).senderId]);
        expect(txLogic.stubs.verify.firstCall.args[2]).to.be.deep.eq(accountsModule.stubs.resolveAccountsForTransactions.getCall(0).returnValue['address']);
        expect(txLogic.stubs.verify.firstCall.args[3]).to.be.deep.eq(undefined);

      });
    });

    it('should call blocksChain.applyBlock propagating broadcast,saveblock and accounts values if all ok', async () => {
      sinon.stub(inst, 'verifyBlock').resolves(Promise.resolve({ errors  : [], verified: true }));
      blockLogic.enqueueResponse('objectNormalize', {id: '1', normalized: 'block', transactions: [] });
      findByIdStub.resolves(null);
      delegatesModule.enqueueResponse('assertValidBlockSlot', Promise.resolve());
      blocksChain.enqueueResponse('applyBlock', Promise.resolve());
      accountsModule.stubs.resolveAccountsForTransactions.resolves({'a': 'b'});
      await inst.processBlock(null, true, false);

      expect(blocksChain.stubs.applyBlock.calledOnce).is.true;
      expect(blocksChain.stubs.applyBlock.firstCall.args).is.deep.eq([
        {id: '1', normalized: 'block', transactions: [] },
        true, // broadcast
        false, // saveblock
        {'a': 'b'}
      ]);
    });
  });

});
