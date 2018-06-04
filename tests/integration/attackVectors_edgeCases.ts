import * as chai from 'chai';
import { expect } from 'chai';
import BigNumber from 'bignumber.js';
import * as chaiAsPromised from 'chai-as-promised';
import { Sequelize } from 'sequelize-typescript';
import initializer from './common/init';
import { toBufferedTransaction } from '../utils/txCrafter';
import {
  createMultiSignTransactionWithSignatures,
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransaction,
  createSendTransaction,
  createVoteTransaction,
  getRandomDelegateWallet
} from './common/utils';
import { Symbols } from '../../src/ioc/symbols';
import { ITransactionLogic, ITransactionPoolLogic } from '../../src/ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule,
  ISystemModule,
  ITransactionsModule,
  ITransportModule
} from '../../src/ioc/interfaces/modules';
import { Ed } from '../../src/helpers';
import { LiskWallet } from 'dpos-offline';

chai.use(chaiAsPromised);
describe('attackVectors/edgeCases', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  const funds = Math.pow(10, 11);
  let senderAccount: LiskWallet;
  let blocksModule: IBlocksModule;
  let accModule: IAccountsModule;
  let txModule: ITransactionsModule;
  let txPool: ITransactionPoolLogic;
  let transportModule: ITransportModule;
  let txLogic: ITransactionLogic;
  let systemModule: ISystemModule;
  let sequelize: Sequelize;
  let ed: Ed;
  beforeEach(async () => {
    const {wallet: randomAccount} = await createRandomAccountWithFunds(funds);
    senderAccount                 = randomAccount;
    ed                            = initializer.appManager.container.get(Symbols.helpers.ed);
    blocksModule                  = initializer.appManager.container.get(Symbols.modules.blocks);
    accModule                     = initializer.appManager.container.get(Symbols.modules.accounts);
    txModule                      = initializer.appManager.container.get(Symbols.modules.transactions);
    transportModule               = initializer.appManager.container.get(Symbols.modules.transport);
    txPool                        = initializer.appManager.container.get(Symbols.logic.transactionPool);
    txLogic                       = initializer.appManager.container.get(Symbols.logic.transaction);
    systemModule                  = initializer.appManager.container.get(Symbols.modules.system);
    sequelize                     = initializer.appManager.container.get(Symbols.generic.sequelize);
  });
  describe('blocks', () => {
    describe('wrong txs', () => {
      it('should disallow block with same tx twice', async () => {
        const lastId = blocksModule.lastBlock.id;
        const tx     = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
        await expect(initializer.rawMineBlockWithTxs(
          [tx, {...tx, hey: 'ou'}].map((t) => toBufferedTransaction(t)),
        )).to.rejectedWith('Encountered duplicate transaction');
        const postAcc = await accModule.getAccount({address: senderAccount.address});
        expect(postAcc.balance).to.be.eq(funds);
        expect(postAcc.u_balance).to.be.eq(funds);
        expect(blocksModule.lastBlock.id).to.be.eq(lastId);
      });
      it('should disallow a block with a previously existing tx', async () => {
        const tx     = await createSendTransaction(1, 1, senderAccount, createRandomWallet().address);
        const lastId = blocksModule.lastBlock.id;
        const preAcc = await accModule.getAccount({address: senderAccount.address});

        await expect(initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)]))
          .to.rejectedWith('Transaction is already confirmed');

        const postAcc = await accModule.getAccount({address: senderAccount.address});

        expect(postAcc.balance).to.be.eq(preAcc.balance);
        expect(postAcc.u_balance).to.be.eq(postAcc.balance);

        expect(blocksModule.lastBlock.id).to.be.eq(lastId);
      });
      it('should disallow block with a tx having a wrong address', async () => {
        const lastId = blocksModule.lastBlock.id;
        const tx     = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
        tx.recipientId = tx.recipientId.toLowerCase();
        await expect(initializer.rawMineBlockWithTxs(
          [tx].map((t) => toBufferedTransaction(t)),
        )).to.rejectedWith('Failed to validate transaction schema');
        const postAcc = await accModule.getAccount({address: senderAccount.address});
        expect(postAcc.balance).to.be.eq(funds);
        expect(postAcc.u_balance).to.be.eq(funds);
        expect(blocksModule.lastBlock.id).to.be.eq(lastId);

        // check tx does not exist in db nor pool
        expect(txPool.transactionInPool(tx.id)).is.false;
        await expect(txModule.getByID(tx.id)).to.be.rejectedWith('Transaction not found');
      });
      it('should disallow block with invalid tx', async () => {
        const tx     = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
        tx.amount = -1;
        const tx2    = await createSendTransaction(0, 2, senderAccount, createRandomWallet().address);
        await expect(initializer.rawMineBlockWithTxs(
          [tx, tx2].map((t) => toBufferedTransaction(t)),
        )).to.rejectedWith('Failed to validate transaction schema: Value -1 is less than minimum 0');
      });
    });

    describe('timestamp edge cases', () => {
      it('should not include tx with negative timestamp', async () => {
        const tx     = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
        tx.timestamp = -1;
        await expect(initializer.rawMineBlockWithTxs(
          [tx].map((t) => toBufferedTransaction(t)),
        )).to.rejectedWith('Failed to validate transaction schema: Value -1 is less than minimum 0');
      });
      it('should reject timestamp with more than 32bit', async () => {
        const tx = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address, {
          timestamp: Math.pow(2, 32) + 1,
        });
        await expect(initializer.rawMineBlockWithTxs(
          [tx].map((t) => toBufferedTransaction(t)),
        )).to.rejectedWith('Invalid transaction timestamp. Timestamp is in the future');
      });
    });

    describe('amount edge cases', () => {
      it('shouldnt allow a block with txs that overspend a single account', async () => {
        const preHeight = blocksModule.lastBlock.height;
        const acc       = await accModule.getAccount({address: senderAccount.address});
        const txs       = await Promise.all(
          new Array(3).fill(null)
            .map(() => createSendTransaction(
              0,
              Math.ceil(funds / 3),
              senderAccount,
              createRandomWallet().address
              )
            )
        );
        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t))))
          .to
          .rejectedWith(/Account does not have enough currency/);

        expect(blocksModule.lastBlock.height).to.be.eq(preHeight);

        // Check account is equal to itself as no txs were made.
        const postAcc = await accModule.getAccount({address: senderAccount.address});
        expect(postAcc.balance).to.be.eq(acc.balance);
        expect(postAcc.u_balance).to.be.eq(acc.u_balance);
        expect(postAcc.u_balance).to.be.eq(postAcc.balance);
      });
      it('should allow spending the total account amount', async () => {
        const sendFees = systemModule.getFees().fees.send;
        const totalPerTx = new BigNumber(funds).minus(new BigNumber(sendFees).multipliedBy(10)).div(10).toNumber();
        expect(Number.isInteger(totalPerTx)).is.true;

        // create 10 txs
        const txs = await Promise.all(
          new Array(10).fill(null)
          .map(() => createSendTransaction(0, totalPerTx, senderAccount, createRandomWallet().address))
        );

        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t)))).to.not.be.rejected;

        const postAcc = await accModule.getAccount({address: senderAccount.address});
        expect(postAcc.balance).to.be.eq(0);
        expect(postAcc.u_balance).to.be.eq(0);
      });
    });

    describe('votes', async () => {
      it('shouldnt allow voting same delegate within same block', async () => {
        const preID          = blocksModule.lastBlock.id;
        const delegate       = getRandomDelegateWallet();
        const preDelegateAcc = await accModule.getAccount({address: delegate.address});
        const preAcc         = await accModule.getAccount({address: senderAccount.address});

        const txs = [
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true, {timestamp: 1}),
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true, {timestamp: 2})
        ];

        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t))))
          .to
          .rejectedWith(/Failed to add vote, account has already voted for this delegate/);

        // consistency checks
        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(blocksModule.lastBlock.id).to.be.eq(preID);
        expect(acc.balance).to.be.eq(funds);
        expect(acc.u_balance).to.be.eq(funds);

        expect(acc.delegates).to.be.deep.eq(preAcc.delegates);

        const delegateAcc = await accModule.getAccount({address: delegate.address});
        expect(delegateAcc.vote).to.be.eq(preDelegateAcc.vote);
      });
      it('shouldnt allow doublevoting same delegate within same tx', async () => {
        const delegate = getRandomDelegateWallet();
        // ^^ Lets hope the 2 delegates are different 1% change of not being the case.
        const tx       = await createVoteTransaction(0, senderAccount, delegate.publicKey, true, {
          asset: {
            votes: [
              `+${delegate.publicKey}`,
              `+${delegate.publicKey}`,
            ],
          },
        });
        await expect(initializer
          .rawMineBlockWithTxs([tx].map((t) => toBufferedTransaction(t))))
          .to
          .rejected;
      });
      it('should not allow removal of just added(same block dif tx) voted delegate', async () => {
        const delegate = getRandomDelegateWallet();
        const txs      = [
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true, {timestamp: 2}),
          await createVoteTransaction(0, senderAccount, delegate.publicKey, false, {timestamp: 2})
        ];
        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t))))
          .to
          .rejectedWith(/Failed to remove vote, account has not voted for this delegate/);
      });
      it('should not allow add+removal of same delegate within same tx', async () => {
        const delegate = getRandomDelegateWallet();
        const txs      = [
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true, {
            asset: {
              votes: [
                `+${delegate.publicKey}`,
                `-${delegate.publicKey}`,
              ],
            },
          }),
        ];
        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t))))
          .to
          .rejectedWith(/Failed to remove vote, account has not voted for this delegate/);
      });
      it('should allow add+removal of 2 diff delegate', async () => {
        const delegate  = getRandomDelegateWallet();
        const delegate2 = getRandomDelegateWallet();
        // ^^ Lets hope the 2 delegates are different 1% change of not being the case.
        await createVoteTransaction(1, senderAccount, delegate.publicKey, true);
        const txs = [
          await createVoteTransaction(0, senderAccount, delegate.publicKey, true, {
            asset: {
              votes: [
                `-${delegate.publicKey}`,
                `+${delegate2.publicKey}`,
              ],
            },
          }),
        ];
        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t))))
          .to.not
          .rejected;

        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.delegates).to.contain(delegate2.publicKey);
      });
    });

    describe('regDelegate', async () => {
      it('should not allow delegate registration from 2 dif tx same block', async () => {
        // sequelize.options.logging = true;
        const txs = [
          await createRegDelegateTransaction(0, senderAccount, 'user1'),
          await createRegDelegateTransaction(0, senderAccount, 'user2'),
        ];

        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t))))
          .to
          .rejectedWith(/Account is already trying to be a delegate/);

        const acc = await accModule.getAccount({address: senderAccount.address});
        // sequelize.options.logging = false;
        expect(acc.username).to.be.null;
        expect(acc.u_username).to.be.null;
        expect(acc.balance).to.be.eq(funds);
        expect(acc.u_balance).to.be.eq(funds);
      });
    });

    describe('multisig registration', async () => {
      it('should not allow two txs registering multisig within same block', async () => {
        const txs = new Array(2).fill(null).map((a, idx) => createMultiSignTransactionWithSignatures(
          senderAccount,
          3,
          new Array(3).fill(null).map(() => createRandomWallet()),
          24,
          {timestamp: idx}
        )).map((t) => {
          t.tx.signatures = t.signatures;
          return t.tx;
        });
        await expect(initializer
          .rawMineBlockWithTxs(txs.map((t) => toBufferedTransaction(t))))
          .to
          .rejected;

        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.balance).to.be.eq(funds);
        expect(acc.multilifetime).to.be.eq(0);
        expect(acc.multimin).to.be.eq(0);
        expect(acc.multisignatures).to.be.deep.eq(null);
      });
    });

  });
});
