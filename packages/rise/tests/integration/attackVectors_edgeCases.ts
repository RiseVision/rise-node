import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Rise, RiseV1Transaction, RiseV2Transaction } from 'dpos-offline';
import { Sequelize } from 'sequelize-typescript';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import initializer from './common/init';

import { SystemModule } from '@risevision/core';
import { AccountsSymbols } from '@risevision/core-accounts';
import {
  BlockLogic,
  BlocksModule,
  BlocksModuleChain,
  BlocksSymbols,
} from '@risevision/core-blocks';
import { AccountsModelForDPOS } from '@risevision/core-consensus-dpos';
import { Crypto } from '@risevision/core-crypto';
import { ModelSymbols } from '@risevision/core-models';
import { AccountsModelWith2ndSign } from '@risevision/core-secondsignature';
import {
  TransactionLogic,
  TransactionPool,
  TransactionsModule,
  TXSymbols,
} from '@risevision/core-transactions';
import { poolProcess } from '@risevision/core-transactions/tests/integration/utils';
import { toNativeTx } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import {
  IAccountsModule,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import { Address, IKeypair } from 'dpos-offline';
import { As } from 'type-tagger';
import {
  confirmTransactions,
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransactionV1,
  createSendTransactionV1,
  createVoteTransactionV1,
  enqueueAndProcessTransactions,
  getRandomDelegateWallet,
} from './common/utils';

chai.use(chaiAsPromised);
// tslint:disable no-unused-expression no-big-function
describe('attackVectors/edgeCases', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  const funds = Math.pow(10, 11);
  let senderAccount: IKeypair & { address: Address };
  let blocksModule: BlocksModule;
  let accModule: IAccountsModule<
    AccountsModelForDPOS & AccountsModelWith2ndSign
  >;
  let txModule: TransactionsModule;
  let txPool: TransactionPool;
  // let transportModule: ITransportModule;
  let blockLogic: BlockLogic;
  let txLogic: TransactionLogic;
  let systemModule: SystemModule;
  let sequelize: Sequelize;
  let ed: Crypto;
  beforeEach(async () => {
    const { wallet: randomAccount } = await createRandomAccountWithFunds(funds);
    senderAccount = randomAccount;
    ed = initializer.appManager.container.get(Symbols.generic.crypto);
    blocksModule = initializer.appManager.container.get(
      BlocksSymbols.modules.blocks
    );
    blockLogic = initializer.appManager.container.get(
      BlocksSymbols.logic.block
    );
    accModule = initializer.appManager.container.get(AccountsSymbols.module);
    txModule = initializer.appManager.container.get(TXSymbols.module);
    // transportModule               = initializer.appManager.container.get(Symbols.modules.transport);
    txPool = initializer.appManager.container.get(TXSymbols.pool);
    txLogic = initializer.appManager.container.get(TXSymbols.logic);
    systemModule = initializer.appManager.container.get(Symbols.modules.system);
    sequelize = initializer.appManager.container.get(ModelSymbols.sequelize);
  });
  describe('blocks', () => {
    describe('wrong txs', () => {
      describe('steal attempt', () => {
        it('senderId from virgin account', async () => {
          const { wallet: randomAccount } = await createRandomAccountWithFunds(
            10000
          );
          const tx = await createSendTransactionV1(
            0,
            1,
            senderAccount,
            createRandomWallet().address
          );
          tx.senderId = randomAccount.address;

          const preSenderAccPOJO = (await accModule.getAccount({
            address: senderAccount.address,
          })).toPOJO();
          const preRandomAccPOJO = (await accModule.getAccount({
            address: randomAccount.address,
          })).toPOJO();
          const lastId = blocksModule.lastBlock.id;

          await expect(
            initializer.rawMineBlockWithTxs([tx].map((t) => toNativeTx(t)))
          ).rejectedWith('Cannot find account from accounts');

          const postSenderAccPOJO = (await accModule.getAccount({
            address: senderAccount.address,
          })).toPOJO();
          const postRandomAccPOJO = (await accModule.getAccount({
            address: randomAccount.address,
          })).toPOJO();

          expect(preRandomAccPOJO).deep.eq(postRandomAccPOJO);
          expect(postSenderAccPOJO).deep.eq(preSenderAccPOJO);
        });
        it('senderId from non virgin account', async () => {
          const { wallet: randomAccount } = await createRandomAccountWithFunds(
            10000
          );
          // Initialize account
          await createSendTransactionV1(
            1,
            1,
            randomAccount,
            randomAccount.address
          );
          const tx = await createSendTransactionV1(
            0,
            1,
            senderAccount,
            createRandomWallet().address
          );
          tx.senderId = randomAccount.address;
          const preSenderAccPOJO = (await accModule.getAccount({
            address: senderAccount.address,
          })).toPOJO();
          const preRandomAccPOJO = (await accModule.getAccount({
            address: randomAccount.address,
          })).toPOJO();

          await expect(
            initializer.rawMineBlockWithTxs([tx].map((t) => toNativeTx(t)))
          ).rejectedWith('Cannot find account from accounts');

          const postSenderAccPOJO = (await accModule.getAccount({
            address: senderAccount.address,
          })).toPOJO();
          const postRandomAccPOJO = (await accModule.getAccount({
            address: randomAccount.address,
          })).toPOJO();

          expect(preSenderAccPOJO).deep.eq(postSenderAccPOJO);
          expect(preRandomAccPOJO).deep.eq(postRandomAccPOJO);
        });
      });
      it('should reject block having tx without senderId', async () => {
        const tx = await createSendTransactionV1(
          0,
          1,
          senderAccount,
          createRandomWallet().address
        );
        const block = await initializer.generateBlock([tx]);
        delete block.transactions[0].senderId;
        await expect(initializer.postBlock(block, 'direct')).rejectedWith(
          'Missing required property: senderId'
        );
      });

      it('should disallow block with same tx twice', async () => {
        const lastId = blocksModule.lastBlock.id;
        const tx = await createSendTransactionV1(
          0,
          1,
          senderAccount,
          createRandomWallet().address
        );
        await expect(
          initializer.rawMineBlockWithTxs(
            [tx, { ...tx, hey: 'ou' }].map((t) => toNativeTx(t))
          )
        ).to.rejectedWith('Encountered duplicate transaction');
        const postAcc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(postAcc.balance).to.be.eq(BigInt(funds));
        expect(postAcc.u_balance).to.be.eq(BigInt(funds));
        expect(blocksModule.lastBlock.id).to.be.eq(lastId);
      });
      it('should disallow block with same tx twice with crafted wrong id', async () => {
        const lastId = blocksModule.lastBlock.id;
        const tx = await createSendTransactionV1(
          0,
          1,
          senderAccount,
          createRandomWallet().address
        );
        await expect(
          initializer.rawMineBlockWithTxs(
            [tx, { ...tx, id: '12123123123123123' }].map((t) => toNativeTx(t)),
            'direct' // Skip P2P and try internal way which is less sensitive
          )
        ).to.rejectedWith('Duplicated transaction found in block with id');
        const postAcc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(postAcc.balance).to.be.eq(BigInt(funds));
        expect(postAcc.u_balance).to.be.eq(BigInt(funds));
        expect(blocksModule.lastBlock.id).to.be.eq(lastId);
      });
      it('should disallow a block with a previously existing tx', async () => {
        const tx = await createSendTransactionV1(
          1,
          1,
          senderAccount,
          createRandomWallet().address
        );
        const lastId = blocksModule.lastBlock.id;
        const preAcc = await accModule.getAccount({
          address: senderAccount.address,
        });

        await expect(
          initializer.rawMineBlockWithTxs([toNativeTx(tx)])
        ).to.rejectedWith(`Transactions already confirmed: ${tx.id}`);

        const postAcc = await accModule.getAccount({
          address: senderAccount.address,
        });

        expect(postAcc.balance).to.be.eq(preAcc.balance);
        expect(postAcc.u_balance).to.be.eq(postAcc.balance);

        expect(blocksModule.lastBlock.id).to.be.eq(lastId);
      });
      it('should disallow block with a tx having a wrong address', async () => {
        const lastId = blocksModule.lastBlock.id;
        const tx = await createSendTransactionV1(
          0,
          1,
          senderAccount,
          createRandomWallet().address
        );
        tx.recipientId = tx.recipientId.toLowerCase() as any;
        await expect(
          initializer.rawMineBlockWithTxs([tx].map((t) => toNativeTx(t)))
        ).to.rejectedWith('Failed to validate transaction schema');
        const postAcc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(postAcc.balance).to.be.eq(BigInt(funds));
        expect(postAcc.u_balance).to.be.eq(BigInt(funds));
        expect(blocksModule.lastBlock.id).to.be.eq(lastId);

        // check tx does not exist in db nor pool
        expect(txPool.transactionInPool(tx.id)).is.false;
        await expect(txModule.getByID(tx.id)).to.be.rejectedWith(
          'Transaction not found'
        );
      });
      it('should disallow block with invalid tx', async () => {
        const tx = await createSendTransactionV1(
          0,
          1,
          senderAccount,
          createRandomWallet().address
        );
        tx.amount = '-1';
        const tx2 = await createSendTransactionV1(
          0,
          2,
          senderAccount,
          createRandomWallet().address
        );
        await expect(
          initializer.rawMineBlockWithTxs([tx, tx2].map((t) => toNativeTx(t)))
        ).to.rejectedWith(
          'tx.amount is either negative or greater than totalAmount'
        );
      });
    });

    describe('timestamp edge cases', () => {
      it('should not include tx with negative timestamp', async () => {
        const tx = await createSendTransactionV1(
          0,
          1,
          senderAccount,
          createRandomWallet().address
        );
        tx.timestamp = -1;
        await expect(
          initializer.rawMineBlockWithTxs([tx].map((t) => toNativeTx(t)))
        ).to.rejectedWith(
          'Failed to validate transaction schema: Value -1 is less than minimum 0'
        );
      });
      it('should reject timestamp in the future 32bit', async function() {
        this.timeout(10000000);
        const tx = await createSendTransactionV1(
          0,
          1,
          senderAccount,
          createRandomWallet().address,
          Math.pow(2, 32) - 2
        );

        // try internal processing
        await expect(
          initializer.rawMineBlockWithTxs(
            [tx].map((t) => toNativeTx(t)),
            'direct'
          )
        ).to.rejectedWith(
          'Invalid transaction timestamp. Timestamp is in the future'
        );
        // Try the same via p2p
        await expect(
          initializer.rawMineBlockWithTxs(
            [tx].map((t) => toNativeTx(t)),
            'p2p' // through p2p
          )
        ).to.rejectedWith(
          'Invalid transaction timestamp. Timestamp is in the future'
        );
      });
    });

    describe('amount edge cases', () => {
      it('shouldnt allow a block with txs that overspend a single account', async () => {
        const preHeight = blocksModule.lastBlock.height;
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        const txs = await Promise.all(
          new Array(3)
            .fill(null)
            .map(() =>
              createSendTransactionV1(
                0,
                Math.ceil(funds / 3),
                senderAccount,
                createRandomWallet().address
              )
            )
        );
        await expect(
          initializer.rawMineBlockWithTxs(txs.map((t) => toNativeTx(t)))
        ).to.rejectedWith(/Account does not have enough currency/);

        expect(blocksModule.lastBlock.height).to.be.eq(preHeight);

        // Check account is equal to itself as no txs were made.
        const postAcc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(postAcc.balance).to.be.eq(acc.balance);
        expect(postAcc.u_balance).to.be.eq(acc.u_balance);
        expect(postAcc.u_balance).to.be.eq(postAcc.balance);
      });
      it('should allow spending the total account amount', async () => {
        const sendFees = systemModule.getFees().fees.send;
        const totalPerTx = (BigInt(funds) - sendFees * 10n) / 10n;

        // create 10 txs
        const txs = await Promise.all(
          new Array(10)
            .fill(null)
            .map(() =>
              createSendTransactionV1(
                0,
                totalPerTx,
                senderAccount,
                createRandomWallet().address
              )
            )
        );

        await expect(
          initializer.rawMineBlockWithTxs(txs.map((t) => toNativeTx(t)))
        ).to.not.be.rejected;

        const postAcc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(postAcc.balance).to.be.eq(0n);
        expect(postAcc.u_balance).to.be.eq(0n);
      });

      it('should accept block with fullspending tx and undoUnconfirm tx which might cause overspending', async () => {
        const tx1 = await createSendTransactionV1(
          0,
          BigInt(funds) - systemModule.getFees().fees.send,
          senderAccount,
          '1R'
        );
        const tx2 = await createSendTransactionV1(
          0,
          BigInt(funds) - systemModule.getFees().fees.send,
          senderAccount,
          '2R'
        );

        await enqueueAndProcessTransactions([tx1]);

        expect(txPool.unconfirmed.has(tx1.id)).is.true;

        await initializer.rawMineBlockWithTxs([toNativeTx(tx2)]);

        // After processing the tx should still be in pool but not unconfirmed
        expect(txModule.transactionInPool(tx1.id)).is.true;
        expect(txPool.unconfirmed.has(tx1.id)).is.false;

        // Aftee processBundled and fillPool kicks in then failure should kick in.
        // removing the tx from the pool
        await poolProcess(initializer.appManager.container);
        expect(txModule.transactionInPool(tx1.id)).is.false;
      });
    });

    describe('votes', async () => {
      it('shouldnt allow voting same delegate within same block', async () => {
        const preID = blocksModule.lastBlock.id;
        const delegate = getRandomDelegateWallet();
        const preDelegateAcc = await accModule.getAccount({
          address: delegate.address,
        });
        const preAcc = await accModule.getAccount({
          address: senderAccount.address,
        });

        const txs = [
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            true,
            { nonce: 1 }
          ),
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            true,
            { nonce: 2 }
          ),
        ];

        await expect(
          initializer.rawMineBlockWithTxs(txs.map((t) => toNativeTx(t)))
        ).to.rejectedWith(/Found conflicting transactions in block/);

        // consistency checks
        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(blocksModule.lastBlock.id).to.be.eq(preID);
        expect(acc.balance).to.be.eq(BigInt(funds));
        expect(acc.u_balance).to.be.eq(BigInt(funds));

        expect(acc.delegates).to.be.deep.eq(preAcc.delegates);

        const delegateAcc = await accModule.getAccount({
          address: delegate.address,
        });
        expect(delegateAcc.vote).to.be.eq(preDelegateAcc.vote);
      });
      it('shouldnt allow doublevoting same delegate within same tx', async () => {
        const delegate = getRandomDelegateWallet();
        // ^^ Lets hope the 2 delegates are different 1% change of not being the case.
        const tx = await createVoteTransactionV1(
          0,
          senderAccount,
          delegate.publicKey,
          true,
          {
            preferences: [
              {
                action: '+',
                delegateIdentifier: delegate.publicKey.toString('hex'),
              },
              {
                action: '+',
                delegateIdentifier: delegate.publicKey.toString('hex'),
              },
            ],
          }
        );
        await expect(
          initializer.rawMineBlockWithTxs([tx].map((t) => toNativeTx(t)))
        ).to.rejected;
      });
      it('should not allow two diff vote txs from same sender in same block', async () => {
        const delegate = getRandomDelegateWallet();
        const txs = [
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            true,
            { nonce: 2 }
          ),
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            false,
            { nonce: 2 }
          ),
        ];
        await expect(
          initializer.rawMineBlockWithTxs(txs.map((t) => toNativeTx(t)))
        ).to.rejectedWith(/Found conflicting transactions in block/);
      });
      it('should not allow add+removal of same delegate within same tx', async () => {
        const delegate = getRandomDelegateWallet();
        const txs = [
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            true,
            {
              preferences: [
                {
                  action: '+',
                  delegateIdentifier: delegate.publicKey.toString('hex'),
                },
                {
                  action: '-',
                  delegateIdentifier: delegate.publicKey.toString('hex'),
                },
              ],
            }
          ),
        ];
        await expect(
          initializer.rawMineBlockWithTxs(txs.map((t) => toNativeTx(t)))
        ).to.rejectedWith(
          /Failed to remove vote, account has not voted for this delegate/
        );
      });
      it('should allow add+removal of 2 diff delegate', async () => {
        const delegate = getRandomDelegateWallet();
        const delegate2 = getRandomDelegateWallet();
        // ^^ Lets hope the 2 delegates are different 1% change of not being the case.
        await createVoteTransactionV1(
          1,
          senderAccount,
          delegate.publicKey,
          true
        );
        const txs = [
          await createVoteTransactionV1(
            0,
            senderAccount,
            delegate.publicKey,
            true,
            {
              preferences: [
                {
                  action: '-',
                  delegateIdentifier: delegate.publicKey.toString('hex'),
                },
                {
                  action: '+',
                  delegateIdentifier: delegate2.publicKey.toString('hex'),
                },
              ],
            }
          ),
        ];
        await expect(
          initializer.rawMineBlockWithTxs(txs.map((t) => toNativeTx(t)))
        ).to.not.rejected;

        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });

        const delegate2Acc = await accModule.getAccount({
          address: delegate2.address,
        });
        expect(acc.delegates).to.deep.eq([delegate2Acc.username]);
      });
    });

    describe('regDelegate', async () => {
      it('should not allow delegate registration from 2 dif tx same block', async () => {
        // sequelize.options.logging = true;
        const txs = [
          await createRegDelegateTransactionV1(0, senderAccount, 'user1'),
          await createRegDelegateTransactionV1(0, senderAccount, 'user2'),
        ];

        await expect(
          initializer.rawMineBlockWithTxs(txs.map((t) => toNativeTx(t)))
        ).to.rejectedWith(/Account is already trying to be a delegate/);

        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        // sequelize.options.logging = false;
        expect(acc.username).to.be.null;
        expect(acc.u_username).to.be.null;
        expect(acc.balance).to.be.eq(BigInt(funds));
        expect(acc.u_balance).to.be.eq(BigInt(funds));
      });
    });

    // describe('multisig registration', async () => {
    //   it('should not allow two txs registering multisig within same block', async () => {
    //     const txs = new Array(2)
    //       .fill(null)
    //       .map((a, idx) =>
    //         createMultiSignTransactionWithSignatures(
    //           senderAccount,
    //           3,
    //           new Array(3).fill(null).map(() => createRandomWallet()),
    //           24,
    //           { timestamp: idx }
    //         )
    //       )
    //       .map((t) => {
    //         t.tx.signatures = t.signatures;
    //         return t.tx;
    //       });
    //     await expect(
    //       initializer.rawMineBlockWithTxs(
    //         txs.map((t) => toNativeTx(t))
    //       )
    //     ).to.rejected;
    //
    //     const acc = await accModule.getAccount({
    //       address: senderAccount.address,
    //     });
    //     expect(acc.balance).to.be.eq(funds);
    //     expect(acc.multilifetime).to.be.eq(0);
    //     expect(acc.multimin).to.be.eq(0);
    //     expect(acc.multisignatures).to.be.deep.eq(null);
    //   });
    // });
  });

  describe('account balance protection (<0)', () => {
    const fee = 10000000;
    let tx: RiseV2Transaction<any>;
    let chainModule: BlocksModuleChain;
    let block: SignedAndChainedBlockType;
    let accsMap: any;
    beforeEach(async () => {
      tx = await createSendTransactionV1(0, funds, senderAccount, '11R');
      chainModule = initializer.appManager.container.get<BlocksModuleChain>(
        BlocksSymbols.modules.chain
      );
      block = await initializer.generateBlock([tx]);
      accsMap = await accModule.txAccounts([toNativeTx(tx)]);
    });
    afterEach(async () => {
      expect(blocksModule.lastBlock.id).to.not.be.eq(block.id);
      const acc = await accModule.getAccount({
        address: senderAccount.address,
      });
      expect(acc.balance).to.be.eq(funds);
      expect(acc.u_balance).to.be.eq(funds);

      await expect(txModule.getByID(tx.id)).rejectedWith(
        'Transaction not found'
      );
    });
    describe('inmemoryy checks', () => {
      it('unconfirmed test', async () => {
        await expect(
          chainModule.applyBlock(block, false, true, accsMap)
        ).to.rejectedWith('does not have enough currency');
      });
      it('confirmed test by poisoning senderAccounts', async () => {
        accsMap[senderAccount.address].u_balance = funds * 10; // should let it go

        await expect(
          chainModule.applyBlock(block, false, true, accsMap)
        ).to.rejectedWith('does not have enough currency');
      });
    });
    describe('databaselevel checks', () => {
      it('db u_balance constraint test bypoisoning senderAccounts', async () => {
        accsMap[senderAccount.address].u_balance = funds * 10; // poison
        accsMap[senderAccount.address].balance = funds * 10; // poison

        await expect(
          chainModule.applyBlock(block, false, true, accsMap)
        ).to.rejectedWith(
          `Address ${
            senderAccount.address
          } cannot go < 0 on balance: ${funds} u_balance: ${-fee}`
        );
      });
      it('db balance constraint test bypoisoning senderAccounts', async () => {
        accsMap[senderAccount.address].u_balance = funds * 10; // poison
        accsMap[senderAccount.address].balance = funds * 10; // poison

        // set u balance to valid value.
        let act = await accModule.getAccount({
          address: senderAccount.address,
        });
        act.u_balance = BigInt(funds * 10);
        await act.save();

        await expect(
          chainModule.applyBlock(block, false, true, accsMap)
        ).to.rejectedWith(
          `Address ${
            senderAccount.address
          } cannot go < 0 on balance: ${-fee} u_balance: ${funds * 10 -
            funds -
            fee}`
        );
        expect(blocksModule.lastBlock.id).to.not.be.eq(block.id);

        const acc = await accModule.getAccount({
          address: senderAccount.address,
        });
        expect(acc.u_balance).be.eq(funds * 10);
        // Restoring u_balance for afterEachChecks
        // set u balance to valid value.
        act = await accModule.getAccount({ address: senderAccount.address });
        act.u_balance = BigInt(funds);
        await act.save();
      });
    });
  });

  describe('block with an invalid tx', () => {
    let tx: RiseV2Transaction<any>;
    let chainModule: BlocksModuleChain;
    let block: SignedAndChainedBlockType;
    let accsMap: any;
    let sandbox: SinonSandbox;
    let destWallet: IKeypair & { address: Address };
    beforeEach(async () => {
      destWallet = createRandomWallet();
      tx = await createSendTransactionV1(
        0,
        funds,
        senderAccount,
        destWallet.address
      );
      await createRandomAccountWithFunds(funds, destWallet);
      chainModule = initializer.appManager.container.get<BlocksModuleChain>(
        BlocksSymbols.modules.chain
      );

      accsMap = await accModule.txAccounts([toNativeTx(tx)]);
      sandbox = sinon.createSandbox();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('databaselayer should reject whole block if tx has negative amount', async () => {
      tx.amount = '-1';
      sandbox.stub(blockLogic, 'objectNormalize').callsFake((t) => t as any);
      block = await initializer.generateBlock([tx]);
      await expect(
        chainModule.applyBlock(block, false, true, accsMap)
      ).rejectedWith('violates check constraint "cnst_amount"');

      expect(blocksModule.lastBlock.id).not.eq(block.id);
      await expect(txModule.getByID(tx.id)).rejectedWith(
        'Transaction not found'
      );
      const senderAcc = await accModule.getAccount({
        address: senderAccount.address,
      });
      expect(senderAcc.u_balance).eq(funds);
      expect(senderAcc.balance).eq(funds);

      const recAcc = await accModule.getAccount({
        address: destWallet.address,
      });
      expect(recAcc.u_balance).eq(funds);
      expect(recAcc.balance).eq(funds);
    });
    it('databaselayer should reject whole block if tx has negative amount', async () => {
      tx.fee = '-1';
      sandbox.stub(blockLogic, 'objectNormalize').callsFake((t) => t as any);
      block = await initializer.generateBlock([tx]);
      await expect(
        chainModule.applyBlock(block, false, true, accsMap)
      ).rejectedWith('violates check constraint "cnst_fee"');

      expect(blocksModule.lastBlock.id).not.eq(block.id);
      expect(txModule.getByID(tx.id)).rejectedWith('Transaction not found');
      const senderAcc = await accModule.getAccount({
        address: senderAccount.address,
      });
      expect(senderAcc.u_balance).eq(funds);
      expect(senderAcc.balance).eq(funds);

      const recAcc = await accModule.getAccount({
        address: destWallet.address,
      });
      expect(recAcc.u_balance).eq(funds);
      expect(recAcc.balance).eq(funds);
    });
  });

  it('should disallow tx with invalid sign', async () => {
    const tx = await createSendTransactionV1(0, 10, senderAccount, '1R');
    tx.signatures = [Buffer.alloc(64).fill(0xab) as Buffer & As<'signature'>];

    await expect(confirmTransactions([tx], false)).rejectedWith(
      'signature is not valid'
    );
  });

  it('should disallow tx with recipient on another network', async () => {
    const tx = await createSendTransactionV1(
      0,
      10,
      senderAccount,
      Rise.calcAddress(senderAccount.publicKey, 'dev')
    );
    await expect(confirmTransactions([tx], false)).rejectedWith(
      'format address'
    );
  });
});
