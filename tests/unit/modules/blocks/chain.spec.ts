import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { Container } from 'inversify';
import { Op } from 'sequelize';
import * as shuffle from 'shuffle-array';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import { IBlocksModuleChain } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { IBaseTransaction } from '../../../../src/logic/transactions';
import { BlocksModuleChain } from '../../../../src/modules/blocks/';
import { createRandomWallet } from '../../../integration/common/utils';
import { BlocksSubmoduleUtilsStub, BusStub, SequenceStub, TransactionsModuleStub } from '../../../stubs';
import { BlockLogicStub } from '../../../stubs/logic/BlockLogicStub';
import TransactionLogicStub from '../../../stubs/logic/TransactionLogicStub';
import AccountsModuleStub from '../../../stubs/modules/AccountsModuleStub';
import BlocksModuleStub from '../../../stubs/modules/BlocksModuleStub';
import { RoundsModuleStub } from '../../../stubs/modules/RoundsModuleStub';
import { generateAccounts } from '../../../utils/accountsUtils';
import { createContainer } from '../../../utils/containerCreator';
import {
  createRandomTransactions,
  createSendTransaction,
  createVoteTransaction,
  toBufferedTransaction
} from '../../../utils/txCrafter';
import { AccountsModel, BlocksModel } from '../../../../src/models';
import DbStub from '../../../stubs/helpers/DbStub';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks/chain', () => {
  let inst: IBlocksModuleChain;
  let instR: BlocksModuleChain;
  let container: Container;
  let processExitStub: SinonStub;
  beforeEach(() => {
    container = createContainer();
    container.rebind(Symbols.modules.blocksSubModules.chain).to(BlocksModuleChain);
    processExitStub = sinon.stub(process, 'exit');

    inst = instR = container.get(Symbols.modules.blocksSubModules.chain);
  });
  afterEach(() => {
    processExitStub.restore();
  });
  let sandbox: SinonSandbox;
  let accountsModule: AccountsModuleStub;
  let blocksModule: BlocksModuleStub;
  let blocksUtils: BlocksSubmoduleUtilsStub;
  let txModule: TransactionsModuleStub;
  let txLogic: TransactionLogicStub;
  let blockLogic: BlockLogicStub;
  let roundsModule: RoundsModuleStub;
  let busStub: BusStub;
  let dbStub: DbStub;
  let blocksModel: typeof BlocksModel;
  let destroyStub: SinonStub;
  let balancesSequence: SequenceStub;

  beforeEach(() => {
    sandbox        = sinon.createSandbox();
    accountsModule = container.get(Symbols.modules.accounts);
    blocksUtils    = container.get(Symbols.modules.blocksSubModules.utils);
    blocksModule   = container.get(Symbols.modules.blocks);
    roundsModule   = container.get(Symbols.modules.rounds);
    txModule       = container.get(Symbols.modules.transactions);
    txLogic        = container.get(Symbols.logic.transaction);
    blockLogic     = container.get(Symbols.logic.block);
    blocksModel    = container.get(Symbols.models.blocks);
    dbStub         = container.get(Symbols.helpers.db);
    destroyStub    = sandbox.stub(blocksModel, 'destroy').resolves();
    balancesSequence = container.getTagged(Symbols.helpers.sequence,
      Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence);
    busStub = container.get(Symbols.helpers.bus);
  });
  afterEach(() => sandbox.restore());

  describe('deleteLastBlock', () => {
    let findStub: SinonStub;
    let accountsScopeStub: SinonStub;
    let accountsFindStub: SinonStub;
    let destroyStub: SinonStub;
    beforeEach(() => {
      destroyStub            = sandbox.stub();
      blocksModule.lastBlock = {
        height       : 10,
        previousBlock: 'previousBlock',
        transactions : [
          { senderPublicKey: 'first' },
          { senderPublicKey: 'second' },
          { senderPublicKey: 'third' },
        ],
        destroy      : destroyStub,
      } as any;
      roundsModule.enqueueResponse('backwardTick', Promise.resolve());
      txLogic.stubs.undoUnconfirmed.resolves([]);
      txLogic.stubs.undo.resolves([]);
      dbStub.stubs.performOps.resolves();
      // accountsModule.stubs.getAccount.callsFake((a) => a);
      accountsModule.stubs.resolveAccountsForTransactions.callsFake((txs)=> {
        const toRet = {};
        txs.forEach((tx) => toRet[tx.senderId] = tx.senderId);
        return toRet;
      });
      sandbox.stub(blocksModel.sequelize, 'transaction').callsFake((cb) => {
        return cb('tx');
      });
      findStub = sandbox.stub(blocksModel, 'findById');
      findStub.resolves({ id: 'previousBlock' });

      const accountsModel = container.get<any>(Symbols.models.accounts);
      accountsFindStub    = sandbox.stub().returns('senderAccount');
      accountsScopeStub   = sandbox.stub(accountsModel, 'scope').returns({
        find: accountsFindStub
      });
    });
    it('should throw error if lastblock is height=1 (genesis)', async () => {
      blocksModule.lastBlock = { height: 1 } as any;
      return expect(inst.deleteLastBlock()).to.be.rejectedWith('Cannot delete genesis block');
    });
    it('should throw error if previousblock is null', async () => {
      blocksUtils.reset();
      findStub.resolves(null);
      await expect(inst.deleteLastBlock()).to.be.rejectedWith('previousBlock is null');
      expect(findStub.called).is.true;
    });
    it('should undo and undoUnconfirmed all included transactions', async () => {
      await inst.deleteLastBlock();
      expect(txLogic.stubs.undo.callCount).to.be.eq(3);
      expect(txLogic.stubs.undoUnconfirmed.callCount).to.be.eq(3);
      for (let i = 0; i < 3; i++) {
        expect(txLogic.stubs.undo.getCall(i).calledBefore(txLogic.stubs.undoUnconfirmed.getCall(i))).is.true;
      }
    });
    it('should call roundsModule backwardTick', async () => {
      await inst.deleteLastBlock();
      expect(roundsModule.stubs.backwardTick.called).is.true;
    });
    it('should call deleteBlock with blockid', async () => {
      blocksModule.lastBlock.id = 'blockid';
      await inst.deleteLastBlock();
      expect(destroyStub.called).is.true;
      expect(destroyStub.firstCall.args[0]).deep.eq({ transaction: 'tx' });
    });
    it('should set new block to blocksModule', async () => {
      await inst.deleteLastBlock();
      expect(blocksModule.lastBlock).to.be.deep.eq({ id: 'previousBlock' });
    });
    it('should return new lastblock', async () => {
      expect(await inst.deleteLastBlock()).to.be.deep.eq({ id: 'previousBlock' });
    });

  });

  describe('deleteAfterBlock', () => {
    it('should issue db query', async () => {
      await inst.deleteAfterBlock(11);
      expect(destroyStub.called).is.true;
      expect(destroyStub.firstCall.args[0]).deep.eq({ where: { [Op.gte]: 11 } });
      expect(destroyStub.firstCall.args[0].where[Op.gte]).deep.eq(11);
    });
  });

  describe('recoverChain', () => {
    it('should call deleteLastBlock', async () => {
      const delLasBloStub = sinon.stub(inst, 'deleteLastBlock').returns(Promise.resolve({}));
      await inst.recoverChain();
      expect(delLasBloStub.called).is.true;
    });
    it('should throw error if deleteLastBlock throws', async () => {
      sinon.stub(inst, 'deleteLastBlock').returns(Promise.reject('error'));
      await expect(inst.recoverChain()).to.be.rejectedWith('error');
    });
  });

  describe('applyGenesisBlock', () => {
    let accounts: LiskWallet[];
    let voteTxs: Array<IBaseTransaction<any>>;
    let sendTxs: Array<IBaseTransaction<any>>;
    let allTxs: Array<IBaseTransaction<any>>;
    beforeEach(() => {
      accountsModule.stubs.setAccountAndGet.returns({});
      txLogic.stubs.applyUnconfirmed.returns(Promise.resolve([]));
      txLogic.stubs.apply.returns(Promise.resolve([]));
      dbStub.stubs.performOps.resolves(null);
      roundsModule.enqueueResponse('tick', Promise.resolve());
      accounts = generateAccounts(5);
      voteTxs  = [
        createVoteTransaction(accounts[0], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
        createVoteTransaction(accounts[1], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
        createVoteTransaction(accounts[2], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
        createVoteTransaction(accounts[3], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
        createVoteTransaction(accounts[4], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
      ].map((t) => toBufferedTransaction(t));
      sendTxs  = [
        createSendTransaction(accounts[0], accounts[0].address, 1, { amount: 10 }),
        createSendTransaction(accounts[1], accounts[0].address, 1, { amount: 10 }),
        createSendTransaction(accounts[2], accounts[0].address, 1, { amount: 10 }),
      ].map((t) => toBufferedTransaction(t));
      allTxs   = sendTxs.concat(voteTxs);

      sandbox.stub(blocksModel.sequelize, 'transaction').callsFake((c) => c('t'));
    });
    it('should call applyUnconfirmed and apply to all txs included in genesis. keeping votes for last', async () => {
      await inst.applyGenesisBlock({ id: 'id', transactions: sendTxs.concat(voteTxs) } as any);

      const totalTxs = voteTxs.length + sendTxs.length;
      expect(txLogic.stubs.applyUnconfirmed.callCount).is.eq(totalTxs);
      expect(txLogic.stubs.apply.callCount).is.eq(totalTxs);
      expect(dbStub.stubs.performOps.callCount).is.eq(totalTxs);

      // Check applyunconfirmed got called before apply
      for (let i = 0; i < totalTxs; i++) {
        expect(txLogic.stubs.applyUnconfirmed.getCall(i).calledBefore(
          txLogic.stubs.apply.getCall(i)
        )).is.true;
      }

      // Check that first were applied the send transactions
      for (let i = 0; i < sendTxs.length; i++) {
        expect(txLogic.stubs.applyUnconfirmed.getCall(i).args[0]).to.be.deep.eq({ ...sendTxs[i], blockId: 'id' });
        expect(txLogic.stubs.apply.getCall(i).args[0]).to.be.deep.eq({ ...sendTxs[i], blockId: 'id' });
      }

      // And then all vote txs
      for (let i = 0; i < voteTxs.length; i++) {
        expect(txLogic.stubs.applyUnconfirmed.getCall(i + sendTxs.length).args[0]).to.be.deep.eq({
          ...voteTxs[i],
          blockId: 'id'
        });
        expect(txLogic.stubs.apply.getCall(i + sendTxs.length).args[0]).to.be.deep.eq({
          ...voteTxs[i],
          blockId: 'id'
        });
      }
    });

    it('should reorder txs to have votes at the end', async () => {
      shuffle(allTxs);
      await inst.applyGenesisBlock({ transactions: allTxs } as any);
      for (let i = 0; i < sendTxs.length; i++) {
        expect(txLogic.stubs.applyUnconfirmed.getCall(i).args[0].type).to
          .be.eq(TransactionType.SEND);
      }
      for (let i = 0; i < voteTxs.length; i++) {
        expect(txLogic.stubs.applyUnconfirmed.getCall(i + sendTxs.length).args[0].type).to
          .be.eq(TransactionType.VOTE);
      }
    });
    it('should call setAccount for each tx.', async () => {
      await inst.applyGenesisBlock({ transactions: voteTxs.concat(sendTxs) } as any);
      expect(accountsModule.stubs.setAccountAndGet.callCount).to.be.eq(allTxs.length);

      for (let i = 0; i < allTxs.length; i++) {
        expect(accountsModule.stubs.setAccountAndGet.getCall(i).args[0])
          .to.be.deep.eq({ publicKey: allTxs[i].senderPublicKey });
      }
    });
    it('should set lastBlock to blocksModule', async () => {
      await inst.applyGenesisBlock({ id: 'hey', transactions: voteTxs.concat(sendTxs) } as any);
      expect(blocksModule.lastBlock.transactions).to.be.deep.eq(allTxs);
      expect(blocksModule.lastBlock.id).to.be.deep.eq('hey');
    });
    it('should roundsModule tick', async () => {
      await inst.applyGenesisBlock({ transactions: voteTxs.concat(sendTxs) } as any);
      expect(roundsModule.stubs.tick.called).is.true;
    });
    it('should fail and process.exit if one tx fail to apply', async () => {
      txLogic.stubs.applyUnconfirmed.rejects();
      await inst.applyGenesisBlock({ transactions: voteTxs.concat(sendTxs) } as any);
      expect(processExitStub.called).is.true;
    });
  });

  describe('applyBlock', () => {
    let accounts: LiskWallet[];
    let voteTxs: Array<ITransaction<any>>;
    let sendTxs: Array<ITransaction<any>>;
    let allTxs: Array<ITransaction<any>>;
    let saveBlockStub: SinonStub;
    let txStub: SinonStub;
    let accountsMap: {[address: string]: AccountsModel};
    beforeEach(() => {
      accounts = generateAccounts(5);
      voteTxs  = [
        createVoteTransaction(accounts[0], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
        createVoteTransaction(accounts[1], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
        createVoteTransaction(accounts[2], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
        createVoteTransaction(accounts[3], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
        createVoteTransaction(accounts[4], 1, { asset: { votes: [`+${accounts[0].publicKey}`] } }),
      ];
      sendTxs  = [
        createSendTransaction(accounts[0], accounts[0].address, 1, { amount: 10 }),
        createSendTransaction(accounts[1], accounts[0].address, 1, { amount: 10 }),
        createSendTransaction(accounts[2], accounts[0].address, 1, { amount: 10 }),
      ];
      allTxs   = sendTxs.concat(voteTxs);
      accountsMap = {};
      accounts.forEach((a) => accountsMap[a.address] = new AccountsModel({address: a.address}));

      accountsModule.stubs.setAccountAndGet.returns({});
      accountsModule.stubs.getAccount.returns({});
      txLogic.stubs.applyUnconfirmed.callsFake((tx) => Promise.resolve([`applyUnconfirmed${tx.id}`]));
      txLogic.stubs.apply.callsFake((tx) => Promise.resolve([`apply${tx.id}`]));
      txModule.stubs.transactionUnconfirmed.returns(false);
      dbStub.enqueueResponse('performOps', Promise.resolve());
      txModule.stubs.removeUnconfirmedTransaction.returns(null);
      txModule.stubs.undoUnconfirmedList.returns(Promise.resolve([]));
      saveBlockStub = sinon.stub(inst, 'saveBlock');
      roundsModule.enqueueResponse('tick', Promise.resolve());
      busStub.enqueueResponse('message', Promise.resolve());
      txStub = sandbox.stub(blocksModel.sequelize, 'transaction').callsFake((t) => t('tx'));
    });
    it('should be wrapped in balanceSequence', async () => {
      expect(balancesSequence.spies.addAndPromise.called).is.false;
      await inst.applyBlock({transactions: allTxs} as any, false, false, accountsMap);
      expect(balancesSequence.spies.addAndPromise.called).is.true;
    })

    it('should skip applyUnconfirmed if txModule.transactionUnconfirmed returns true');
    it('should return undefined if cleanup in processing and set instance.isCleaning in true', async () => {
      await inst.cleanup();
      expect(await inst.applyBlock({ transactions: allTxs } as any, false, false, accountsMap)).to.be.undefined;
      expect(txModule.stubs.undoUnconfirmedList.notCalled).to.be.true;
    });
    it('should set .isProcessing to true to prevent shutdowns', async () => {
      txStub.callsFake((t) => {
        expect(inst['isProcessing']).to.be.true;
        return t('tx');
      });
      await inst.applyBlock({ transactions: allTxs } as any, false, false, accountsMap);
      // tslint:disable-next-line: no-string-literal
      expect(inst['isProcessing']).to.be.false;
    });
    it('should applyUnconfirmed every tx in block', async () => {
      await inst.applyBlock({ transactions: allTxs } as any, false, false, accountsMap);
      expect(txLogic.stubs.applyUnconfirmed.callCount).is.eq(allTxs.length);
      for (let i = 0; i < allTxs.length; i++) {
        expect(txLogic.stubs.applyUnconfirmed.getCall(i).args[0]).is.eq(allTxs[i]);
      }
    });
    it('should then apply transactions and remove them from unconfirmed state', async () => {
      await inst.applyBlock({ transactions: allTxs } as any, false, false, accountsMap);
      expect(txLogic.stubs.apply.callCount).to.be.eq(allTxs.length);
      expect(txModule.stubs.removeUnconfirmedTransaction.callCount).to.be.eq(allTxs.length);

      // For each tx there should be an apply and a removeUnconfirmedTransaction and the order matter.
      for (let i = 0; i < allTxs.length; i++) {
        expect(txLogic.stubs.apply.getCall(i).args[0]).to.be.eq(allTxs[i]);
        expect(txModule.stubs.removeUnconfirmedTransaction.getCall(i).args[0]).to.be.eq(allTxs[i].id);
        expect(txLogic.stubs.apply.getCall(i).calledBefore(
          txModule.stubs.removeUnconfirmedTransaction.getCall(i))
        );
      }
    });
    it('should call dbStub with infos obtained from ops returned by applyUnconfirmed and apply', async () => {
      await inst.applyBlock({ transactions: allTxs } as any, false, false, accountsMap);
      expect(dbStub.stubs.performOps.called).is.true;
      expect(dbStub.stubs.performOps.callCount).is.eq(1);
      expect(dbStub.stubs.performOps.firstCall.args[0]).is.deep.eq(allTxs
        .map((t) => `applyUnconfirmed${t.id}`)
        .concat(allTxs.map((t) => `apply${t.id}`)));
      expect(dbStub.stubs.performOps.firstCall.args[1]).to.be.deep.eq('tx');
    });
    it('should eventually call saveBlock if true is passed, not otherwise', async () => {
      const block = { transactions: allTxs } as any;
      await inst.applyBlock(block, false, false, accountsMap);
      expect(saveBlockStub.called).is.false;
      // 2nd run needs also some new enqueue
      busStub.enqueueResponse('message', Promise.resolve());
      roundsModule.enqueueResponse('tick', Promise.resolve());
      dbStub.enqueueResponse('performOps', Promise.resolve());
      await inst.applyBlock(block, false, true, accountsMap);
      expect(saveBlockStub.called).is.true;
    });
    it('should broadcast a newBlock message through the bus', async () => {
      const block = { transactions: allTxs } as any;
      await inst.applyBlock(block, false, false, accountsMap);
      expect(busStub.stubs.message.called).is.true;
      expect(busStub.stubs.message.firstCall.args[0]).is.eq('newBlock');
      expect(busStub.stubs.message.firstCall.args[1]).is.deep.eq(block);
      expect(busStub.stubs.message.firstCall.args[2]).is.deep.eq(false);
    });
    it('should roundsModule.tick', async () => {
      const block = { transactions: allTxs } as any;
      await inst.applyBlock(block, false, false, accountsMap);
      expect(roundsModule.stubs.tick.called).is.true;
      expect(roundsModule.stubs.tick.firstCall.args[0]).is.deep.eq(block);
    });

    it('should wrap all ops within tx', async () => {
      const preStub  = sandbox.stub();
      const postStub = sandbox.stub();
      txStub.callsFake(async (t) => {
        preStub();
        await t('tx');
        postStub();
      });
      const block = { transactions: allTxs } as any;

      await inst.applyBlock(block, false, true, accountsMap);
      expect(preStub.called).is.true;
      expect(postStub.called).is.true;
      expect(preStub.calledBefore(txLogic.stubs.applyUnconfirmed)).is.true;
      expect(preStub.calledBefore(txLogic.stubs.apply)).is.true;
      expect(preStub.calledBefore(saveBlockStub)).is.true;
      expect(preStub.calledBefore(roundsModule.stubs.tick)).is.true;

      expect(postStub.calledAfter(txLogic.stubs.applyUnconfirmed)).is.true;
      expect(postStub.calledAfter(txLogic.stubs.apply)).is.true;
      expect(postStub.calledAfter(saveBlockStub)).is.true;
      expect(postStub.calledAfter(roundsModule.stubs.tick)).is.true;

    });

  });

  describe('saveBlock', () => {
    let dbHelperStub: DbStub;
    beforeEach(() => {
      dbHelperStub = container.get(Symbols.helpers.db);
      busStub.enqueueResponse('message', null);
      txLogic.stubs.afterSave.resolves();
      txLogic.stubs.dbSave.callsFake((ob) => ({saveOp: 'save', txID: ob.id, txType: ob.type}));
      blockLogic.enqueueResponse('dbSave', { table: 'blocks', values: { id: '1' }, fields: ['id'] });
      dbHelperStub.enqueueResponse('performOps', Promise.resolve());
    });
    it('should call performOps using tx object', async () => {
      const transactions = createRandomTransactions({send: 2});
      await inst.saveBlock({ transactions } as any, 'dbTX' as any);
      expect(dbHelperStub.stubs.performOps.called).is.true;
      expect(dbHelperStub.stubs.performOps.firstCall.args[1]).is.eq('dbTX');
    });
    it('should call dbSave for block and for each transaction and use the output for performOps', async () => {
      const transactions = createRandomTransactions({send: 2, vote: 2});
      await inst.saveBlock({ transactions } as any, 'dbTX' as any);
      expect(txLogic.stubs.dbSave.called).is.true;
      expect(txLogic.stubs.dbSave.callCount).is.eq(4);

      expect(blockLogic.stubs.dbSave.called).is.true;
      expect(dbHelperStub.stubs.performOps.firstCall.args[0]).to.be.deep.eq([
        { table: 'blocks', values: { id: '1' }, fields: ['id'] },
        ... transactions.map((t) => ({saveOp: 'save', txID: t.id, txType: t.type})),
      ]);
    });
    it('should emit bus message for transactionsSaved', async () => {
      const transactions = createRandomTransactions({ send: 5, vote: 3 });
      await inst.saveBlock({ transactions } as any, 'dbTX' as any);
      expect(busStub.stubs.message.called).is.true;
      expect(busStub.stubs.message.firstCall.args[0]).is.eq('transactionsSaved');
      expect(busStub.stubs.message.firstCall.args[1]).is.deep.eq(transactions);
    });
    it('should call txlogic.afterSave for each bundled tx', async () => {
      const transactions = createRandomTransactions({ send: 5 });
      await inst.saveBlock({ transactions } as any, 'dbTX' as any);
      expect(txLogic.stubs.afterSave.callCount).is.eq(5);
      for (let i = 0; i < 5; i++) {
        expect(txLogic.stubs.afterSave.getCall(i).args[0]).to.be.deep.eq(transactions[i]);
      }
    });
    it('should work even if block does not have any transaction', async () => {
      await inst.saveBlock({ transactions: [] } as any, 'dbTX' as any);
    });
  });

  describe('saveGenesisBlock', () => {
    let findByIdStub: SinonStub;
    let txStub: SinonStub;
    let saveBlockStub: SinonStub;
    beforeEach(() => {
      findByIdStub = sandbox.stub(blocksModel, 'findById');
      txStub = sandbox.stub(blocksModel.sequelize, 'transaction').callsFake((t) => t('tx'));
      saveBlockStub = sandbox.stub(inst, 'saveBlock');
    });
    it('should call db.query to check if genesis already exists and not call saveBlock', async () => {
      findByIdStub.resolves({ id: '16985986483000875063' });
      await inst.saveGenesisBlock();
      expect(txStub.called).is.false;
      expect(saveBlockStub.called).is.false;
    });
    it('should call saveBlock and pass tx if genesis does not exist', async () => {
      findByIdStub.resolves(null);
      await inst.saveGenesisBlock();
      expect(txStub.called).is.true;
      expect(saveBlockStub.called).is.true;
      expect(txStub.calledBefore(saveBlockStub)).is.true;
      expect(saveBlockStub.firstCall.args[1]).is.eq('tx');
    });
  });

  describe('cleanup', () => {
    it('should return promise', () => {
      expect(inst.cleanup()).to.be.an.instanceOf(Promise);
    });
    it('should resolve', () => {
      return expect(inst.cleanup()).to.be.fulfilled;
    });
    it('should wait until isProcessing is false and then return', async () => {
      const timers         = sinon.useFakeTimers();
      // tslint:disable-next-line: no-string-literal
      inst['isProcessing'] = true;
      const stub           = sinon.stub();
      const p              = inst.cleanup()
        .then(stub)
        .catch(stub);

      expect(stub.called).is.false;
      timers.tick(10000);
      expect(stub.called).is.false;
      // tslint:disable-next-line: no-string-literal
      inst['isProcessing'] = false;
      timers.tick(10000);
      await p;

      expect(stub.called).is.true;
      expect(stub.callCount).is.eq(1);

      timers.restore();
    });
  });

});
