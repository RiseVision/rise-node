import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline';
import { ITransactionLogic, ITransactionPoolLogic } from '../../src/ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule,
  ISystemModule,
  ITransactionsModule,
  ITransportModule
} from '../../src/ioc/interfaces/modules';
import { Symbols } from '../../src/ioc/symbols';
import initializer from './common/init';
import {
  confirmTransactions,
  createMultiSignTransaction,
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransaction,
  createSecondSignTransaction,
  createSendTransaction,
  createVoteTransaction,
  getRandomDelegateWallet
} from './common/utils';
import { Ed } from '../../src/helpers';

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
  let transportModule: ITransportModule;
  let txLogic: ITransactionLogic;
  let ed: Ed;
  beforeEach(async () => {
    const { wallet: randomAccount } = await createRandomAccountWithFunds(funds);
    senderAccount                   = randomAccount;
    ed                              = initializer.appManager.container.get(Symbols.helpers.ed);
    blocksModule                    = initializer.appManager.container.get(Symbols.modules.blocks);
    accModule                       = initializer.appManager.container.get(Symbols.modules.accounts);
    txModule                        = initializer.appManager.container.get(Symbols.modules.transactions);
    transportModule                 = initializer.appManager.container.get(Symbols.modules.transport);
    txPool                          = initializer.appManager.container.get(Symbols.logic.transactionPool);
    txLogic                         = initializer.appManager.container.get(Symbols.logic.transaction);
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

      it('should not be allowed to add & remove within same transaction (user did not confirmed vote)', async () => {
        const delegate = getRandomDelegateWallet();
        // Add vote
        await createVoteTransaction(1, senderAccount, delegate.publicKey, true, {
          asset: {
            votes: [
              `+${delegate.publicKey}`,
              `-${delegate.publicKey}`,
            ],
          },
        });

        // Account should show no delegate.
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.delegates).is.null;

        expect(blocksModule.lastBlock.transactions).is.empty;
      });

      it('should not be allowed to remove and readd vote in same tx', async () => {
        const delegate = getRandomDelegateWallet();

        await createVoteTransaction(1, senderAccount, delegate.publicKey, true);
        // remove and readd
        await createVoteTransaction(1, senderAccount, delegate.publicKey, true, {
          asset: {
            votes: [
              `-${delegate.publicKey}`,
              `+${delegate.publicKey}`,
            ],
          },
        });

        // Account should show delegate.
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.delegates).to.contain(delegate.publicKey);

        // Tx should not be included
        expect(blocksModule.lastBlock.transactions).is.empty;
        expect(blocksModule.lastBlock.height).is.eq(4);
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

    describe('secondSignature', () => {
      it('should allow secondSignature creation', async () => {
        const pk  = createRandomWallet().publicKey;
        const tx  = await createSecondSignTransaction(1, senderAccount, pk);
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.secondPublicKey).to.be.eq(pk);
        expect(acc.secondSignature).to.be.eq(1);
      });
      it('should not allow 2 second signature in 2 diff blocks', async () => {
        const pk  = createRandomWallet().publicKey;
        const pk2 = createRandomWallet().publicKey;
        const tx  = await createSecondSignTransaction(1, senderAccount, pk);
        const tx2 = await createSecondSignTransaction(1, senderAccount, pk2);
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.secondPublicKey).to.be.eq(pk);
        expect(acc.secondSignature).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions).is.empty;
      });
      it('should not allow 2 second signature in same block', async () => {
        const pk  = createRandomWallet().publicKey;
        const pk2 = createRandomWallet().publicKey;
        const txs = [
          await createSecondSignTransaction(0, senderAccount, pk),
          await createSecondSignTransaction(0, senderAccount, pk2),
        ];
        await confirmTransactions(txs, 1);
        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.secondPublicKey).to.be.eq(pk2);
        expect(acc.secondSignature).to.be.eq(1);
        expect(blocksModule.lastBlock.transactions.length).is.eq(1);
      });
    });

    describe('multiSignature', () => {
      it('should create multisignature account', async () => {
        const keys     = new Array(3).fill(null).map(() => createRandomWallet());
        const signedTx = createMultiSignTransaction(senderAccount, 3, keys.map((k) => `+${k.publicKey}`));
        await txModule.receiveTransactions([signedTx], false, false);
        await initializer.rawMineBlocks(1);
        // In pool => valid and not included in block.
        expect(txPool.multisignature.has(signedTx.id)).is.true;
        // let it sign by all.

        const signatures = keys.map((k) => ed.sign(
          txLogic.getHash(signedTx, true, false),
          {
            privateKey: Buffer.from(k.privKey, 'hex'),
            publicKey : Buffer.from(k.publicKey, 'hex'),
          }
        ).toString('hex'));

        await transportModule.receiveSignatures(signatures.map((sig) => ({
          signature  : sig,
          transaction: signedTx.id,
        })));

        await initializer.rawMineBlocks(1);

        const acc = await accModule.getAccount({ address: senderAccount.address });
        expect(acc.multisignatures).to.be.an('array');

        for (const k of keys) {
          expect(acc.multisignatures).to.contain(k.publicKey);
        }
        expect(acc.multimin).to.be.eq(3);
        expect(acc.multilifetime).to.be.eq(24);
      });
      it('should not allow min > than keys', async () => {
        const keys     = new Array(3).fill(null).map(() => createRandomWallet());
        const signedTx = createMultiSignTransaction(senderAccount, 4, keys.map((k) => `+${k.publicKey}`));
        return expect(txModule.receiveTransactions([signedTx], false, false)).to.be
          .rejectedWith('Invalid multisignature min. Must be less than or equal to keysgroup size');
      });
      it('should keep tx in multisignature tx pool until all signature arrives, even if min is 2', async () => {
        const keys     = new Array(3).fill(null).map(() => createRandomWallet());
        const signedTx = createMultiSignTransaction(senderAccount, 2, keys.map((k) => `+${k.publicKey}`));
        await txModule.receiveTransactions([signedTx], false, false);
        await initializer.rawMineBlocks(1);
        // In pool => valid and not included in block.
        expect(txPool.multisignature.has(signedTx.id)).is.true;

        // let it sign by all.
        const signatures = keys.map((k) => ed.sign(
          txLogic.getHash(signedTx, true, false),
          {
            privateKey: Buffer.from(k.privKey, 'hex'),
            publicKey : Buffer.from(k.publicKey, 'hex'),
          }
        ).toString('hex'));

        for (let i = 0; i < signatures.length - 1; i++) {
          await transportModule.receiveSignatures([{
            signature: signatures[i],
            transaction: signedTx.id,
          }]);
          await initializer.rawMineBlocks(1);
          const acc = await accModule.getAccount({ address: senderAccount.address });
          expect(acc.multisignatures).to.be.null;
          expect(txPool.multisignature.has(signedTx.id)).is.true;
        }
      });
    });

  });

});
