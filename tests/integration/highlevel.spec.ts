import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline';
import { ITransactionPoolLogic } from '../../src/ioc/interfaces/logic';
import { IAccountsModule, IBlocksModule, ISystemModule, ITransactionsModule } from '../../src/ioc/interfaces/modules';
import { Symbols } from '../../src/ioc/symbols';
import initializer from './common/init';
import {
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransaction,
  createSendTransaction,
  createVoteTransaction,
  getRandomDelegateWallet
} from './common/utils';

// tslint:disable no-unused-expression
chai.use(chaiAsPromised);
describe('highlevel checks', () => {
  const funds = Math.pow(10, 11);
  let senderAccount: LiskWallet;
  initializer.setup();
  let blocksModule: IBlocksModule;
  let accModule: IAccountsModule;
  let txModule: ITransactionsModule;
  let txPool: ITransactionPoolLogic;
  beforeEach(async () => {
    const { wallet: randomAccount } = await createRandomAccountWithFunds(funds);
    senderAccount                   = randomAccount;
    blocksModule                    = initializer.appManager.container.get(Symbols.modules.blocks);
    accModule                       = initializer.appManager.container.get(Symbols.modules.accounts);
    txModule                        = initializer.appManager.container.get(Symbols.modules.transactions);
    txPool                          = initializer.appManager.container.get(Symbols.logic.transactionPool);
  });
  afterEach(async () => {
    await initializer.rawDeleteBlocks(blocksModule.lastBlock.height - 1);
  });

  describe('txs', () => {
    describe('send', () => {
      it('should not allow spending all the money the account have (fees)', async () => {
        const tx = await createSendTransaction(1, funds, senderAccount, '1R');
        // Blocks should be forged anyway
        expect(blocksModule.lastBlock.height).is.eq(3);
        // txmodule should not find it in db
        await expect(txModule.getByID(tx.id)).to.be.rejectedWith('Transaction not found');
        // Tx pool should not have it in pool
        expect(txPool.transactionInPool(tx.id)).is.false;
      });
      it('should allow spending all money without fee', async () => {
        const systemModule: ISystemModule = initializer.appManager.container.get(Symbols.modules.system);

        const tx = await createSendTransaction(1, funds - systemModule.getFees().fees.send, senderAccount, '1R');
        expect(blocksModule.lastBlock.height).is.eq(3);

        // txmodule should be in db with correct confimed height
        const dbTX = await txModule.getByID(tx.id);
        expect(dbTX.id).to.be.deep.eq(tx.id);
        expect(dbTX.height).to.be.eq(3);

        // Tx pool should not have it in pool
        expect(txPool.transactionInPool(tx.id)).is.false;
      });

      it('should not include one of the tx exceeding account balance', async () => {
        const txs = await Promise.all(
          new Array(3).fill(null)
            .map(() => createSendTransaction(
              0,
              Math.ceil(funds / 3), senderAccount,
              createRandomWallet().address
              )
            )
        );
        await txModule.receiveTransactions(txs, false, false);
        await initializer.rawMineBlocks(1);

        expect(blocksModule.lastBlock.transactions.length).to.be.eq(2);
        // All of the transactions should not in pool anymore.
        for (const stx of txs) {
          expect(await txPool.transactionInPool(stx.id)).to.be.false;
        }
      });
    });
    describe('votes', () => {
      it('should not be allowed to vote for 2 different account in same block', async () => {
        const delegate1 = getRandomDelegateWallet();
        const delegate2 = getRandomDelegateWallet();
        const txs       = [
          await createVoteTransaction(0, senderAccount, delegate1.publicKey, true),
          await createVoteTransaction(0, senderAccount, delegate2.publicKey, true),
        ];
        await txModule.receiveTransactions(txs, false, false);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to vote for same account in same block', async () => {
        const delegate = getRandomDelegateWallet();
        const txs      = [
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true, { timestamp: 1 }),
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true),
        ];
        await txModule.receiveTransactions(txs, false, false);
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to vote/unvote within same block', async () => {
        const delegate = getRandomDelegateWallet();
        const txs      = [
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true),
          await createVoteTransaction(0, senderAccount, delegate.publicKey, false),
        ];
        try {
          await txModule.receiveTransactions(txs, false, false);
        } catch (e) {
          void 0;
        }
        await initializer.rawMineBlocks(1);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions[0].id).to.be.eq(txs[0].id);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
      });
      it('should not be allowed to unvote something that was not voted in', async () => {
        const delegate = getRandomDelegateWallet();
        await createVoteTransaction(1, senderAccount, delegate.publicKey, false);
        expect(blocksModule.lastBlock.height).to.be.eq(3);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(0);
      });

      it('should be allowed add and then remove vote. (correctly with db reflecting data state.)', async () => {
        const delegate = getRandomDelegateWallet();
        // Add vote
        await createVoteTransaction(1, senderAccount, delegate.publicKey, true);
        let acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.delegates).to.contain(delegate.publicKey);

        // Remove vote
        await createVoteTransaction(1, senderAccount, delegate.publicKey, false);
        acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.delegates).is.null;
        expect(blocksModule.lastBlock.height).to.be.eq(4);
        expect(blocksModule.lastBlock.transactions.length).to.be.eq(1);
      });
    });
    describe('delegate', () => {
      it('should allow registering a delegate', async () => {
        await createRegDelegateTransaction(1, senderAccount, 'vekexasia');
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.username).is.eq('vekexasia');
      });
      it('should not allow delegate name with empty name', async () => {
        await createRegDelegateTransaction(1, senderAccount, '');
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow delegate registration with strange chars', async () => {
        await createRegDelegateTransaction(1, senderAccount, ':)');
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow delegate name longer than 20 chars', async () => {
        await createRegDelegateTransaction(1, senderAccount, 'aaaaaaaaaaaaaaaaaaaaa');
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow addressLike delegate', async () => {
        await createRegDelegateTransaction(1, senderAccount, senderAccount.address.substr(10));
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow 2 accounts with same delegate name', async () => {
        await createRegDelegateTransaction(1, senderAccount, 'vekexasia');
        const { wallet } = await createRandomAccountWithFunds(funds);
        await createRegDelegateTransaction(1, wallet, 'vekexasia');
        let acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.username).is.eq('vekexasia');

        // Second account should not have same name
        acc = await accModule.getAccount({ address: wallet.address });
        expect(acc.username).is.null;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow same account 2 delegate registrations', async () => {
        await createRegDelegateTransaction(1, senderAccount, 'vekexasia');
        await createRegDelegateTransaction(1, senderAccount, 'meow');

        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.username).is.eq('vekexasia');

        expect(await accModule.getAccount({ username: 'meow' })).is.undefined;
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow same account 2 delegate within same block', async () => {
        const txs = [
          await createRegDelegateTransaction(0, senderAccount, 'vekexasia'),
          await createRegDelegateTransaction(0, senderAccount, 'meow'),
        ];

        await txModule.receiveTransactions(txs, false, false);
        await initializer.rawMineBlocks(1);
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.username).is.eq('meow');

        expect(await accModule.getAccount({ username: 'vekexasia' })).is.undefined;
        expect(blocksModule.lastBlock.transactions.length).is.eq(1);
      });
    });

  });

});
