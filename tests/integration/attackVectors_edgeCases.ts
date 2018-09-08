import * as chai from 'chai';
import { expect } from 'chai';
import BigNumber from 'bignumber.js';
import * as sinon from 'sinon';
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
import { IBlockLogic, ITransactionLogic, ITransactionPoolLogic } from '../../src/ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule, IBlocksModuleChain,
  ISystemModule,
  ITransactionsModule,
  ITransportModule
} from '../../src/ioc/interfaces/modules';
import { Ed } from '../../src/helpers';
import { LiskWallet } from 'dpos-offline';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { SignedAndChainedBlockType } from '../../src/logic';
import { SinonSandbox } from 'sinon';

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
  let blockLogic: IBlockLogic;
  let txLogic: ITransactionLogic;
  let systemModule: ISystemModule;
  let sequelize: Sequelize;
  let ed: Ed;
  beforeEach(async () => {
    const {wallet: randomAccount} = await createRandomAccountWithFunds(funds);
    senderAccount                 = randomAccount;
    ed                            = initializer.appManager.container.get(Symbols.helpers.ed);
    blocksModule                  = initializer.appManager.container.get(Symbols.modules.blocks);
    blockLogic                    = initializer.appManager.container.get(Symbols.logic.block);
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
      describe('steal attempt', () => {
        it('senderId from virgin account', async () => {

          const {wallet: randomAccount} = await createRandomAccountWithFunds(10000);
          const tx     = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
          tx['senderId'] = randomAccount.address;

          const preSenderAccPOJO = (await accModule.getAccount({address: senderAccount.address})).toPOJO();
          const preRandomAccPOJO = (await accModule.getAccount({address: randomAccount.address})).toPOJO();
          const lastId = blocksModule.lastBlock.id;

          await expect(initializer.rawMineBlockWithTxs(
            [tx].map((t) => toBufferedTransaction(t)),
          )).rejectedWith(`Stealing attempt type.1 for ${randomAccount.address}`);

          const postSenderAccPOJO = (await accModule.getAccount({address: senderAccount.address})).toPOJO();
          const postRandomAccPOJO = (await accModule.getAccount({address: randomAccount.address})).toPOJO();

          expect(preRandomAccPOJO).deep.eq(postRandomAccPOJO);
          expect(postSenderAccPOJO).deep.eq({...preSenderAccPOJO, publicKey: senderAccount.publicKey});
        });
        it('senderId from non virgin account', async () => {
          const {wallet: randomAccount} = await createRandomAccountWithFunds(10000);
          // Initialize account
          await createSendTransaction(1, 1, randomAccount, randomAccount.address);
          const tx     = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
          tx['senderId'] = randomAccount.address;
          const preSenderAccPOJO = (await accModule.getAccount({address: senderAccount.address})).toPOJO();
          const preRandomAccPOJO = (await accModule.getAccount({address: randomAccount.address})).toPOJO();

          await expect(initializer.rawMineBlockWithTxs(
            [tx].map((t) => toBufferedTransaction(t)),
          )).rejectedWith(`Stealing attempt type.2 for ${randomAccount.address}`);

          const postSenderAccPOJO = (await accModule.getAccount({address: senderAccount.address})).toPOJO();
          const postRandomAccPOJO = (await accModule.getAccount({address: randomAccount.address})).toPOJO();

          expect(preSenderAccPOJO).deep.eq(postSenderAccPOJO);
          expect(preRandomAccPOJO).deep.eq(postRandomAccPOJO);
        });
      });
      it('should reject block having tx without senderId', async () => {
        const tx     = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
        const block = await initializer.generateBlock([tx]);
        delete block.transactions[0].senderId;
        await expect(initializer.postBlock(block)).rejectedWith('Missing required property: senderId');
      });

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
      it('should disallow block with same tx twice with crafted wrong id', async () => {
        const lastId = blocksModule.lastBlock.id;
        const tx     = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
        await expect(initializer.rawMineBlockWithTxs(
          [tx, {...tx, id: '12123123123123123'}].map((t) => toBufferedTransaction(t)),
        )).to.rejectedWith('Duplicated transaction found in block with id');
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
          .to.rejectedWith(`Transactions already confirmed: ${tx.id}`);

        const postAcc = await accModule.getAccount({address: senderAccount.address});

        expect(postAcc.balance).to.be.eq(preAcc.balance);
        expect(postAcc.u_balance).to.be.eq(postAcc.balance);

        expect(blocksModule.lastBlock.id).to.be.eq(lastId);
      });
      it('should disallow block with a tx having a wrong address', async () => {
        const lastId   = blocksModule.lastBlock.id;
        const tx       = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
        tx.recipientId = tx.recipientId.toLowerCase();
        await expect(initializer.rawMineBlockWithTxs(
          [tx].map((t) => toBufferedTransaction(t))
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
        const tx  = await createSendTransaction(0, 1, senderAccount, createRandomWallet().address);
        tx.amount = -1;
        const tx2 = await createSendTransaction(0, 2, senderAccount, createRandomWallet().address);
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
        const sendFees   = systemModule.getFees().fees.send;
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

      it('should accept block with fullspending tx and undoUnconfirm tx which might cause overspending', async () => {

        const tx1 = await createSendTransaction(0, funds - systemModule.getFees().fees.send, senderAccount, '1R');
        const tx2 = await createSendTransaction(0, funds - systemModule.getFees().fees.send, senderAccount, '2R');

        await transportModule.receiveTransactions([tx1], null, false);
        await txPool.processBundled();
        await txModule.fillPool();

        expect(txModule.transactionUnconfirmed(tx1.id)).is.true;

        await initializer.rawMineBlockWithTxs([toBufferedTransaction(tx2)]);

        // After processing the tx should still be in pool but not unconfirmed
        expect(txModule.transactionInPool(tx1.id)).is.true;
        expect(txModule.transactionUnconfirmed(tx1.id)).is.false;

        // Aftee processBundled and fillPool kicks in then failure should kick in.
        // removing the tx from the pool
        await txPool.processBundled();
        await txModule.fillPool();
        expect(txModule.transactionInPool(tx1.id)).is.false;

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

  describe('account balance protection (<0)', () => {
    const fee = 10000000;
    let tx: ITransaction;
    let chainModule: IBlocksModuleChain;
    let block: SignedAndChainedBlockType;
    let accsMap: any;
    beforeEach(async () => {
      tx          = await createSendTransaction(0, funds, senderAccount, '11R');
      chainModule = initializer.appManager.container
        .get<IBlocksModuleChain>(Symbols.modules.blocksSubModules.chain);
      block       = await initializer.generateBlock([tx]);
      accsMap     = await accModule.resolveAccountsForTransactions([toBufferedTransaction(tx)]);
    });
    afterEach(async () => {
      expect(blocksModule.lastBlock.id).to.not.be.eq(block.id);
      const acc = await accModule.getAccount({address: senderAccount.address});
      expect(acc.balance).to.be.eq(funds);
      expect(acc.u_balance).to.be.eq(funds);

      await expect(txModule.getByID(tx.id)).rejectedWith('Transaction not found');
    });
    describe('inmemoryy checks', () => {
      it('unconfirmed test', async () => {
        await expect(chainModule.applyBlock(block, false, true, accsMap))
          .to.rejectedWith('does not have enough currency');
      });
      it('confirmed test by poisoning senderAccounts', async () => {
        accsMap[senderAccount.address].u_balance = funds * 10; // should let it go

        await expect(chainModule.applyBlock(block, false, true, accsMap))
          .to.rejectedWith('does not have enough currency');
      });
    });
    describe('databaselevel checks', () => {
      it('db u_balance constraint test bypoisoning senderAccounts', async () => {
        accsMap[senderAccount.address].u_balance = funds * 10; // poison
        accsMap[senderAccount.address].balance   = funds * 10; // poison

        await expect(chainModule.applyBlock(block, false, true, accsMap))
          .to.rejectedWith(`Address ${senderAccount.address} cannot go < 0 on balance: ${funds} u_balance: ${-fee}`);
      });
      it('db balance constraint test bypoisoning senderAccounts', async () => {
        accsMap[senderAccount.address].u_balance = funds * 10; // poison
        accsMap[senderAccount.address].balance   = funds * 10; // poison

        // set u balance to valid value.
        await accModule.setAccountAndGet({address: senderAccount.address, u_balance: funds * 10});

        await expect(chainModule.applyBlock(block, false, true, accsMap))
          .to.rejectedWith(`Address ${senderAccount.address} cannot go < 0 on balance: ${-fee} u_balance: ${funds * 10 - funds - fee}`);
        expect(blocksModule.lastBlock.id).to.not.be.eq(block.id);

        const acc = await accModule.getAccount({address: senderAccount.address});
        expect(acc.u_balance).be.eq(funds * 10);
        // Restoring u_balance for afterEachChecks
        await accModule.setAccountAndGet({address: acc.address, u_balance: funds});

      });
    });
  });

  describe('block with an invalid tx', () => {
    let tx: ITransaction;
    let chainModule: IBlocksModuleChain;
    let block: SignedAndChainedBlockType;
    let accsMap: any;
    let sandbox: SinonSandbox;
    let destWallet: LiskWallet;
    beforeEach(async () => {
      destWallet = createRandomWallet();
      tx         = await createSendTransaction(0, funds, senderAccount, destWallet.address);
      await createRandomAccountWithFunds(funds, destWallet);
      chainModule = initializer.appManager.container
        .get<IBlocksModuleChain>(Symbols.modules.blocksSubModules.chain);

      accsMap = await accModule.resolveAccountsForTransactions([toBufferedTransaction(tx)]);
      sandbox = sinon.createSandbox();
    });
    afterEach(() => {
      sandbox.restore();
    })
    it('databaselayer should reject whole block if tx has negative amount', async () => {
      tx.amount = -1;
      sandbox.stub(blockLogic, 'objectNormalize').callsFake((t) => t);
      block = await initializer.generateBlock([tx]);
      await expect(chainModule.applyBlock(block, false, true, accsMap))
        .rejectedWith('violates check constraint "cnst_amount"');

      expect(blocksModule.lastBlock.id).not.eq(block.id);
      expect(txModule.getByID(tx.id)).rejectedWith('Transaction not found');
      const senderAcc = await accModule.getAccount({address: senderAccount.address});
      expect(senderAcc.u_balance).eq(funds);
      expect(senderAcc.balance).eq(funds);

      const recAcc = await accModule.getAccount({address: destWallet.address});
      expect(recAcc.u_balance).eq(funds);
      expect(recAcc.balance).eq(funds);
    });
    it('databaselayer should reject whole block if tx has negative amount', async () => {
      tx.fee = -1;
      sandbox.stub(blockLogic, 'objectNormalize').callsFake((t) => t);
      block = await initializer.generateBlock([tx]);
      await expect(chainModule.applyBlock(block, false, true, accsMap))
        .rejectedWith('violates check constraint "cnst_fee"');

      expect(blocksModule.lastBlock.id).not.eq(block.id);
      expect(txModule.getByID(tx.id)).rejectedWith('Transaction not found');
      const senderAcc = await accModule.getAccount({address: senderAccount.address});
      expect(senderAcc.u_balance).eq(funds);
      expect(senderAcc.balance).eq(funds);

      const recAcc = await accModule.getAccount({address: destWallet.address});
      expect(recAcc.u_balance).eq(funds);
      expect(recAcc.balance).eq(funds);
    });
  });
});
