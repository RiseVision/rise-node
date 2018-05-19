import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { Container } from 'inversify';
import * as shuffle from 'shuffle-array';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import { IBlocksModuleChain } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { IBaseTransaction } from '../../../../src/logic/transactions';
import { BlocksModuleChain } from '../../../../src/modules/blocks/';
import { createRandomWallet } from '../../../integration/common/utils';
import { BlocksSubmoduleUtilsStub, BusStub, TransactionsModuleStub } from '../../../stubs';
import DbStub from '../../../stubs/helpers/DbStub';
import { BlockLogicStub } from '../../../stubs/logic/BlockLogicStub';
import TransactionLogicStub from '../../../stubs/logic/TransactionLogicStub';
import AccountsModuleStub from '../../../stubs/modules/AccountsModuleStub';
import BlocksModuleStub from '../../../stubs/modules/BlocksModuleStub';
import { RoundsModuleStub } from '../../../stubs/modules/RoundsModuleStub';
import { generateAccounts } from '../../../utils/accountsUtils';
import { createContainer } from '../../../utils/containerCreator';
import { createRandomTransactions, createSendTransaction, createVoteTransaction } from '../../../utils/txCrafter';

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

  let accountsModule: AccountsModuleStub;
  let blocksModule: BlocksModuleStub;
  let blocksUtils: BlocksSubmoduleUtilsStub;
  let txModule: TransactionsModuleStub;
  let txLogic: TransactionLogicStub;
  let blockLogic: BlockLogicStub;
  let roundsModule: RoundsModuleStub;
  let dbStub: DbStub;
  let busStub: BusStub;
  beforeEach(() => {
    accountsModule = container.get(Symbols.modules.accounts);
    blocksUtils    = container.get(Symbols.modules.blocksSubModules.utils);
    blocksModule   = container.get(Symbols.modules.blocks);
    roundsModule   = container.get(Symbols.modules.rounds);
    txModule       = container.get(Symbols.modules.transactions);
    txLogic        = container.get(Symbols.logic.transaction);
    blockLogic     = container.get(Symbols.logic.block);

    dbStub  = container.get(Symbols.generic.db);
    busStub = container.get(Symbols.helpers.bus);
  });

  describe('deleteBlock', () => {
    it('should call db with provided blockid', async () => {
      dbStub.enqueueResponse('none', Promise.resolve());

      await inst.deleteBlock('1');
      expect(dbStub.stubs.none.called).is.true;
      expect(dbStub.stubs.none.firstCall.args[0]).to.be.deep.eq('DELETE FROM blocks WHERE "id" = ${id};');
      expect(dbStub.stubs.none.firstCall.args[1]).to.be.deep.eq({id: '1'});

    });
    it('should remap eventual database error', async () => {
      dbStub.enqueueResponse('none', Promise.reject('haaaaaaa'));
      await expect(inst.deleteBlock('1')).to.be.rejectedWith('Blocks#deleteBlock error');
    });
  });

  describe('deleteLastBlock', () => {
    let deleteBlockStub: SinonStub;
    beforeEach(() => {
      blocksModule.lastBlock = {
        height       : 10,
        previousBlock: 'previousBlock',
        transactions : [
          {senderPublicKey: 'first'},
          {senderPublicKey: 'second'},
          {senderPublicKey: 'third'},
        ],
      } as any;
      roundsModule.enqueueResponse('backwardTick', Promise.resolve());
      deleteBlockStub = sinon.stub(inst, 'deleteBlock').returns(Promise.resolve());
      txModule.stubs.undo.returns(Promise.resolve());
      txModule.stubs.undoUnconfirmed.returns(Promise.resolve());
      blocksUtils.enqueueResponse('loadBlocksPart', [{id: 'previousBlock'}]);
      accountsModule.stubs.getAccount.callsFake((a) => a);
    });
    it('should throw error if lastblock is height=1 (genesis)', async () => {
      blocksModule.lastBlock = {height: 1} as any;
      return expect(inst.deleteLastBlock()).to.be.rejectedWith('Cannot delete genesis block');
    });
    it('should throw error if previousblock is null', async () => {
      blocksUtils.reset();
      blocksUtils.enqueueResponse('loadBlocksPart', []);
      return expect(inst.deleteLastBlock()).to.be.rejectedWith('previousBlock is null');
    });
    it('should undo and undoUnconfirmed all included transactions', async () => {
      await inst.deleteLastBlock();
      expect(txModule.stubs.undo.callCount).to.be.eq(3);
      expect(txModule.stubs.undoUnconfirmed.callCount).to.be.eq(3);
      for (let i = 0; i < 3; i++) {
        expect(txModule.stubs.undo.getCall(i).calledBefore(txModule.stubs.undoUnconfirmed.getCall(i))).is.true;
      }
    });
    it('should call roundsModule backwardTick', async () => {
      await inst.deleteLastBlock();
      expect(roundsModule.stubs.backwardTick.called).is.true;
    });
    it('should call deleteBlock with blockid', async () => {
      blocksModule.lastBlock.id = 'blockid';
      await inst.deleteLastBlock();
      expect(deleteBlockStub.called).is.true;
      expect(deleteBlockStub.firstCall.args[0]).to.be.deep.eq('blockid');
    });
    it('should set new block to blocksModule', async () => {
      await inst.deleteLastBlock();
      expect(blocksModule.lastBlock).to.be.deep.eq({id: 'previousBlock'});
    });
    it('should return new lastblock', async () => {
      expect(await inst.deleteLastBlock()).to.be.deep.eq({id: 'previousBlock'});
    });

    describe('unrecoverable exit failures', () => {
      it('should process.exit if getAccount fails for tx', async () => {
        accountsModule.stubs.getAccount.rejects();
        await inst.deleteLastBlock();
        expect(processExitStub.called).is.true;
      });
      it('should process.exit if undo fails tx', async () => {
        txModule.stubs.undo.rejects();
        await inst.deleteLastBlock();
        expect(processExitStub.called).is.true;
      });
      it('should process.exit if undoUnconfirmed fails tx', async () => {
        txModule.stubs.undoUnconfirmed.rejects();
        await inst.deleteLastBlock();
        expect(processExitStub.called).is.true;
      });
      it('should process.exit if backwardTick fails', async () => {
        roundsModule.stubs.backwardTick.rejects();
        await inst.deleteLastBlock();
        expect(processExitStub.called).is.true;
      });
      it('should process.exit if deleteBlock fails', async () => {
        deleteBlockStub.rejects();
        await inst.deleteLastBlock();
        expect(processExitStub.called).is.true;
      });
    });
  });

  describe('deleteAfterBlock', () => {
    it('should issue db query', async () => {
      dbStub.enqueueResponse('query', Promise.resolve());
      await inst.deleteAfterBlock('id');
      expect(dbStub.stubs.query.firstCall.args[0]).to.be.eq(
        'DELETE FROM blocks WHERE "height" >= (SELECT "height" FROM blocks WHERE "id" = ${id});'
      );
      expect(dbStub.stubs.query.firstCall.args[1]).to.be.deep.eq(
        {id: 'id'}
      );

    });
    it('should remap error if db throws error', async () => {
      dbStub.enqueueResponse('query', Promise.reject('error'));
      await expect(inst.deleteAfterBlock('id')).to
        .be.rejectedWith('Blocks#deleteAfterBlock error');
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
      txModule.stubs.applyUnconfirmed.returns(Promise.resolve());
      txModule.stubs.apply.returns(Promise.resolve());
      roundsModule.enqueueResponse('tick', Promise.resolve());
      accounts = generateAccounts(5);
      voteTxs  = [
        createVoteTransaction(accounts[0], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
        createVoteTransaction(accounts[1], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
        createVoteTransaction(accounts[2], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
        createVoteTransaction(accounts[3], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
        createVoteTransaction(accounts[4], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
      ];
      sendTxs  = [
        createSendTransaction(accounts[0], accounts[0].address, 1, {amount: 10}),
        createSendTransaction(accounts[1], accounts[0].address, 1, {amount: 10}),
        createSendTransaction(accounts[2], accounts[0].address, 1, {amount: 10}),
      ];
      allTxs   = sendTxs.concat(voteTxs);
    });
    it('should call applyUnconfirmed and apply to all txs included in genesis. keeping votes for last', async () => {
      await inst.applyGenesisBlock({transactions: sendTxs.concat(voteTxs)} as any);

      const totalTxs = voteTxs.length + sendTxs.length;
      expect(txModule.stubs.applyUnconfirmed.callCount).is.eq(totalTxs);
      expect(txModule.stubs.apply.callCount).is.eq(totalTxs);

      // Check applyunconfirmed got called before apply
      for (let i = 0; i < totalTxs; i++) {
        expect(txModule.stubs.applyUnconfirmed.getCall(i).calledBefore(
          txModule.stubs.apply.getCall(i)
        )).is.true;
      }

      // Check that first were applied the send transactions
      for (let i = 0; i < sendTxs.length; i++) {
        expect(txModule.stubs.applyUnconfirmed.getCall(i).args[0]).to.be.deep.eq(sendTxs[i]);
        expect(txModule.stubs.apply.getCall(i).args[0]).to.be.deep.eq(sendTxs[i]);
      }

      // And then all vote txs
      for (let i = 0; i < voteTxs.length; i++) {
        expect(txModule.stubs.applyUnconfirmed.getCall(i + sendTxs.length).args[0]).to.be.deep.eq(voteTxs[i]);
        expect(txModule.stubs.apply.getCall(i + sendTxs.length).args[0]).to.be.deep.eq(voteTxs[i]);
      }
    });

    it('should reorder txs to have votes at the end', async () => {
      shuffle(allTxs);
      await inst.applyGenesisBlock({transactions: allTxs} as any);
      for (let i = 0; i < sendTxs.length; i++) {
        expect(txModule.stubs.applyUnconfirmed.getCall(i).args[0].type).to
          .be.eq(TransactionType.SEND);
      }
      for (let i = 0; i < voteTxs.length; i++) {
        expect(txModule.stubs.applyUnconfirmed.getCall(i + sendTxs.length).args[0].type).to
          .be.eq(TransactionType.VOTE);
      }
    });
    it('should call setAccount for each tx.', async () => {
      await inst.applyGenesisBlock({transactions: voteTxs.concat(sendTxs)} as any);
      expect(accountsModule.stubs.setAccountAndGet.callCount).to.be.eq(allTxs.length);

      for (let i = 0; i < allTxs.length; i++) {
        expect(accountsModule.stubs.setAccountAndGet.getCall(i).args[0])
          .to.be.deep.eq({publicKey: allTxs[i].senderPublicKey});
      }
    });
    it('should set lastBlock to blocksModule', async () => {
      await inst.applyGenesisBlock({transactions: voteTxs.concat(sendTxs)} as any);
      expect(blocksModule.lastBlock).to.be.deep.eq({transactions: allTxs} as any);
    });
    it('should roundsModule tick', async () => {
      await inst.applyGenesisBlock({transactions: voteTxs.concat(sendTxs)} as any);
      expect(roundsModule.stubs.tick.called).is.true;
    });
    it('should fail and process.exit if one tx fail to apply', async () => {
      txModule.stubs.applyUnconfirmed.rejects();
      await inst.applyGenesisBlock({transactions: voteTxs.concat(sendTxs)} as any);
      expect(processExitStub.called).is.true;
    });
  });

  describe('applyBlock', () => {
    let accounts: LiskWallet[];
    let voteTxs: Array<ITransaction<any>>;
    let sendTxs: Array<ITransaction<any>>;
    let allTxs: Array<ITransaction<any>>;
    let saveBlockStub: SinonStub;
    beforeEach(() => {
      accounts = generateAccounts(5);
      voteTxs  = [
        createVoteTransaction(accounts[0], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
        createVoteTransaction(accounts[1], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
        createVoteTransaction(accounts[2], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
        createVoteTransaction(accounts[3], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
        createVoteTransaction(accounts[4], 1, {asset: {votes: [`+${accounts[0].publicKey}`]}}),
      ];
      sendTxs  = [
        createSendTransaction(accounts[0], accounts[0].address, 1, {amount: 10}),
        createSendTransaction(accounts[1], accounts[0].address, 1, {amount: 10}),
        createSendTransaction(accounts[2], accounts[0].address, 1, {amount: 10}),
      ];
      allTxs   = sendTxs.concat(voteTxs);

      accountsModule.stubs.setAccountAndGet.returns({});
      accountsModule.stubs.getAccount.returns({});
      txModule.stubs.applyUnconfirmed.returns(Promise.resolve());
      txModule.stubs.apply.returns(Promise.resolve());
      txModule.stubs.removeUnconfirmedTransaction.returns(null);
      txModule.stubs.undoUnconfirmedList.returns(Promise.resolve([]));
      txModule.stubs.applyUnconfirmedIds.returns(Promise.resolve());
      saveBlockStub = sinon.stub(inst, 'saveBlock');
      roundsModule.enqueueResponse('tick', Promise.resolve());
      dbStub.stubs.tx.returns(Promise.resolve());
      busStub.enqueueResponse('message', Promise.resolve());
    });
    it('should return undefined if cleanup in processing and set instance.isCleaning in true', async () => {
      await inst.cleanup();
      expect(await inst.applyBlock({transactions: allTxs} as any, false, false)).to.be.undefined;
      expect(txModule.stubs.undoUnconfirmedList.notCalled).to.be.true;
    });
    it('should set .isProcessing to true to prevent shutdowns', async () => {
      const p = inst.applyBlock({transactions: allTxs} as any, false, false);
      // tslint:disable-next-line: no-string-literal
      expect(inst['isProcessing']).to.be.true;
      await p;
      // tslint:disable-next-line: no-string-literal
      expect(inst['isProcessing']).to.be.false;
    });
    it('should undo all unconfirmed transactions', async () => {
      await inst.applyBlock({transactions: allTxs} as any, false, false);
      expect(txModule.stubs.undoUnconfirmedList.called).is.true;
    });
    it('should applyUnconfirmed every tx in block', async () => {
      await inst.applyBlock({transactions: allTxs} as any, false, false);
      expect(txModule.stubs.applyUnconfirmed.callCount).is.eq(allTxs.length);
      for (let i = 0; i < allTxs.length; i++) {
        expect(txModule.stubs.applyUnconfirmed.getCall(i).args[0]).is.eq(allTxs[i]);
      }
    });
    it('should undoUnconfirmed already applied transactions if one fails', async () => {
      txModule.stubs.applyUnconfirmed.onCall(allTxs.length / 2).returns(Promise.reject('forced fail'));
      txLogic.stubs.undoUnconfirmed.resolves();
      await expect(inst.applyBlock({transactions: allTxs} as any, false, false))
        .to.be.rejectedWith('forced fail');
      expect(txLogic.stubs.undoUnconfirmed.callCount).to.be.eq(allTxs.length / 2);
      for (let i = 0; i < allTxs.length / 2; i++) {
        expect(txLogic.stubs.undoUnconfirmed.getCall(i).args[0]).to.be.deep.eq(allTxs[i]);
      }
    });
    it('should then apply transactions and remove them from unconfirmed state', async () => {
      await inst.applyBlock({transactions: allTxs} as any, false, false);
      expect(txModule.stubs.apply.callCount).to.be.eq(allTxs.length);
      expect(txModule.stubs.removeUnconfirmedTransaction.callCount).to.be.eq(allTxs.length);

      // For each tx there should be an apply and a removeUnconfirmedTransaction and the order matter.
      for (let i = 0; i < allTxs.length; i++) {
        expect(txModule.stubs.apply.getCall(i).args[0]).to.be.eq(allTxs[i]);
        expect(txModule.stubs.removeUnconfirmedTransaction.getCall(i).args[0]).to.be.eq(allTxs[i].id);
        expect(txModule.stubs.apply.getCall(i).calledBefore(
          txModule.stubs.removeUnconfirmedTransaction.getCall(i))
        );
      }
    });
    it('should eventually call saveBlock if true is passed, not otherwise', async () => {
      const block = {transactions: allTxs} as any;
      await inst.applyBlock(block, false, false);
      expect(saveBlockStub.called).is.false;
      // 2nd run needs also some new enqueue
      busStub.enqueueResponse('message', Promise.resolve());
      roundsModule.enqueueResponse('tick', Promise.resolve());
      await inst.applyBlock(block, false, true);
      expect(saveBlockStub.called).is.true;
    });
    it('should broadcast a newBlock message through the bus', async () => {
      const block = {transactions: allTxs} as any;
      await inst.applyBlock(block, false, false);
      expect(busStub.stubs.message.called).is.true;
      expect(busStub.stubs.message.firstCall.args[0]).is.eq('newBlock');
      expect(busStub.stubs.message.firstCall.args[1]).is.deep.eq(block);
      expect(busStub.stubs.message.firstCall.args[2]).is.deep.eq(false);
    });
    it('should roundsModule.tick', async () => {
      const block = {transactions: allTxs} as any;
      await inst.applyBlock(block, false, false);
      expect(roundsModule.stubs.tick.called).is.true;
      expect(roundsModule.stubs.tick.firstCall.args[0]).is.deep.eq(block);
    });
    it('should applyUnconfirmedIds with not confirmed transactions', async () => {
      const block     = {transactions: allTxs} as any;
      const randomTxs = [
        createSendTransaction(createRandomWallet(), '1R', 1, {amount: 1}),
        createSendTransaction(createRandomWallet(), '2R', 1, {amount: 1}),
        createVoteTransaction(createRandomWallet(), 1, {assets: {votes: ['+b']}}),
      ];
      txModule.stubs.undoUnconfirmedList.resolves(randomTxs.concat(allTxs.slice(0, 5)).map((tx) => tx.id));
      await inst.applyBlock(block, false, false);
      expect(txModule.stubs.applyUnconfirmedIds.called).is.true;
      expect(txModule.stubs.applyUnconfirmedIds.firstCall.args[0]).to.be.deep.eq(randomTxs.map((tx) => tx.id));
    });

    describe('exit failures', () => {
      it('should eventually call process.exit if already unconfirmed txs cannot be undone', async () => {
        txModule.stubs.undoUnconfirmedList.rejects();
        const block = {transactions: allTxs} as any;
        try {
          await inst.applyBlock(block, false, false);
        } catch (e) {
          void 0;
        }
        expect(processExitStub.called).is.true;
      });

      it('should process.exit if one tx cannot be applied', async () => {
        txModule.stubs.apply.rejects();
        const block = {transactions: allTxs} as any;
        await inst.applyBlock(block, false, false);
        expect(processExitStub.called).is.true;
      });

      it('should process.exit if saveBlock rejects', async () => {
        saveBlockStub.rejects();
        const block = {transactions: allTxs} as any;
        await inst.applyBlock(block, false, true);
        expect(processExitStub.called).is.true;
      });
    });

  });

  describe('saveBlock', () => {
    beforeEach(() => {
      busStub.enqueueResponse('message', null);
      txLogic.stubs.afterSave.resolves();
      txLogic.stubs.dbSave.returns({table: 'transactions', values: {id: '1'}, fields: ['id']});
      blockLogic.enqueueResponse('dbSave', {table: 'blocks', values: {id: '1'}, fields: ['id']});
    });
    it('should call wrap all db stuff in db.tx', async () => {
      const txStub = {
        batch: sinon.stub().resolves(),
        none : sinon.stub(),
      };
      dbStub.stubs.tx.resetBehavior();
      dbStub.stubs.tx.resetHistory();
      dbStub.stubs.tx.callsArgWith(0, txStub);
      // simulate another table for clustering
      txLogic.stubs.dbSave.onCall(3).returns({table: 'vote_table', values: {id: '1'}, fields: ['id']});

      const transactions = createRandomTransactions({send: 5, vote: 3});
      await inst.saveBlock({transactions} as any);

      expect(dbStub.stubs.tx.called).is.true;
      expect(txStub.batch.called).is.true;

    });
    it('should call dbSave for all transactions in block', async () => {
      const txStub = {
        batch: sinon.stub().resolves(),
        none : sinon.stub(),
      };
      dbStub.stubs.tx.resetHistory();
      dbStub.stubs.tx.resetBehavior();
      dbStub.stubs.tx.callsArgWith(0, txStub);

      const transactions = createRandomTransactions({send: 5, vote: 3});
      await inst.saveBlock({transactions} as any);
      // Check that txLogic.dbSave was called one for each tx.
      for (let i = 0; i < transactions.length; i++) {
        expect(txLogic.stubs.dbSave.getCall(i).args[0]).to.be.deep.eq(transactions[i]);
      }
    });
    it('should emit bus message for transactionsSaved', async () => {
      const transactions = createRandomTransactions({send: 5, vote: 3});
      dbStub.enqueueResponse('tx', Promise.resolve());
      await inst.saveBlock({transactions} as any);
      expect(busStub.stubs.message.called).is.true;
      expect(busStub.stubs.message.firstCall.args[0]).is.eq('transactionsSaved');
      expect(busStub.stubs.message.firstCall.args[1]).is.deep.eq(transactions);
    });
    it('should call txlogic.afterSave for each bundled tx', async () => {
      dbStub.stubs.tx.resolves();
      const transactions = createRandomTransactions({send: 5});
      await inst.saveBlock({transactions} as any);
      expect(txLogic.stubs.afterSave.callCount).is.eq(5);
      for (let i = 0; i < 5; i++) {
        expect(txLogic.stubs.afterSave.getCall(i).args[0]).to.be.deep.eq(transactions[i]);
      }
    });
    it('should work even if block does not have any transaction', async () => {
      const txStub = {
        batch: sinon.stub().resolves(),
        none : sinon.stub(),
      };
      dbStub.stubs.tx.resetHistory();
      dbStub.stubs.tx.resetBehavior();
      dbStub.stubs.tx.callsArgWith(0, txStub);
      await inst.saveBlock({transactions: []} as any);
    });
  });

  describe('saveGenesisBlock', () => {
    it('should call db.query to check if genesis already exists', async () => {
      dbStub.enqueueResponse('query', Promise.resolve([{id: '16985986483000875063'}]));
      await inst.saveGenesisBlock();
      expect(dbStub.stubs.query.calledOnce).is.true;
      expect(dbStub.stubs.query.firstCall.args[1]).to.be.deep.eq({id: '16985986483000875063'});
    });
    it('should call saveBlock only if genesis does not exist', async () => {
      dbStub.enqueueResponse('query', Promise.resolve([]));

      const stub = sinon.stub(inst, 'saveBlock');
      await inst.saveGenesisBlock();
      expect(stub.called).is.true;
      expect(stub.calledOnce).is.true;

      stub.resetHistory();
      dbStub.enqueueResponse('query', Promise.resolve([{id: 'aaa'}]));
      await inst.saveGenesisBlock();
      expect(stub.called).is.false;
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
      const timers   = sinon.useFakeTimers();
      // tslint:disable-next-line: no-string-literal
      inst['isProcessing'] = true;
      const stub = sinon.stub();
      const p = inst.cleanup()
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
