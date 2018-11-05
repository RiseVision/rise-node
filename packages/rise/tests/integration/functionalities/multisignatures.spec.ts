import { SystemModule } from '@risevision/core';
import { AccountsSymbols } from '@risevision/core-accounts';
import {
  BlocksModule,
  BlocksModuleChain,
  BlocksSymbols,
} from '@risevision/core-blocks';
import { IAccountsModule, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { AccountsModelWithMultisig } from '@risevision/core-multisignature';
import {
  MultisignaturesModule,
  MultisigSymbols,
} from '@risevision/core-multisignature';
import {
  PoolManager,
  TransactionLogic,
  TransactionPool,
  TransactionsModel,
  TransactionsModule,
  TXSymbols,
} from '@risevision/core-transactions';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {
  CreateSignatureTx,
  LiskWallet,
  MultiSignatureTx,
  SendTx,
} from 'dpos-offline';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import {
  createSendTransaction,
  toBufferedTransaction,
} from '../../../../core-transactions/tests/unit/utils/txCrafter';
import initializer from '../common/init';
import {
  createMultiSignAccount,
  createMultiSignTransactionWithSignatures,
  createRandomAccountsWithFunds,
  createRandomAccountWithFunds,
  createRandomWallet,
  createSecondSignTransaction,
  createSendTransaction as createAndConfirmSendTransaction,
  getRandomDelegateWallet,
} from '../common/utils';

chai.use(chaiAsPromised);
// tslint:disable no-unused-expression no-big-function no-identical-functions object-literal-sort-keys

describe('functionalities.multisignature', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  let wallet: LiskWallet;

  let accountsModule: IAccountsModule<AccountsModelWithMultisig>;
  let blocksModule: BlocksModule;
  let blocksSubChainModule: BlocksModuleChain;
  let txModule: TransactionsModule;
  let multisigModule: MultisignaturesModule;
  let systemModule: SystemModule;
  let txPool: TransactionPool;
  let poolManager: PoolManager;
  let txLogic: TransactionLogic;

  let TxModel: typeof TransactionsModel;
  beforeEach(async () => {
    const { wallet: w } = await createRandomAccountWithFunds(1e10);
    wallet = w;

    TxModel = initializer.appManager.container.getNamed(
      ModelSymbols.model,
      TXSymbols.model
    );
    accountsModule = initializer.appManager.container.get(
      AccountsSymbols.module
    );
    blocksModule = initializer.appManager.container.get(
      BlocksSymbols.modules.blocks
    );
    blocksSubChainModule = initializer.appManager.container.get(
      BlocksSymbols.modules.chain
    );
    multisigModule = initializer.appManager.container.get(
      MultisigSymbols.module
    );
    txModule = initializer.appManager.container.get(TXSymbols.module);
    systemModule = initializer.appManager.container.get(Symbols.modules.system);
    txLogic = initializer.appManager.container.get(TXSymbols.logic);
    txPool = initializer.appManager.container.get(TXSymbols.pool);
    poolManager = initializer.appManager.container.get(TXSymbols.poolManager);
  });
  it('should create a multisig account', async () => {
    const { keys, tx } = await createMultiSignAccount(
      wallet,
      [createRandomWallet(), createRandomWallet(), createRandomWallet()],
      3
    );

    const dbTX = await TxModel.findById(tx.id);
    expect(dbTX).exist;
  });

  it('should not allow creating a multisig account without main account signature', async () => {
    const { wallet: w } = await createRandomAccountWithFunds(1e10);

    const keys = await createRandomAccountsWithFunds(3, 1e10);

    const multisigTx = new MultiSignatureTx({
      multisignature: {
        keysgroup: keys.map((k) => `+${k.account.publicKey}`),
        lifetime: 48,
        min: 2,
      },
    })
      .set('senderPublicKey', w.publicKey)
      .set('fee', systemModule.getFees().fees.multisignature)
      .set('timestamp', 1)
      .set('requesterPublicKey', keys[1].account.publicKey)
      .sign(keys[1].account.privKey);

    multisigTx.senderId = w.address;
    multisigTx.signatures = keys.map((k) =>
      k.account.getSignatureOfTransaction(multisigTx)
    );

    await expect(
      initializer.rawMineBlockWithTxs([toBufferedTransaction(multisigTx)])
    ).rejectedWith('Account or requester account is not multisignature');
  });
  it('should not allow creating multisig account without main account second signature', async () => {
    const secondWallet = createRandomWallet();
    const secondSign = wallet.signTransaction(
      new CreateSignatureTx({
        signature: { publicKey: secondWallet.publicKey },
      })
        .set('fee', systemModule.getFees().fees.secondsignature)
        .set('timestamp', 1)
    );
    await initializer.rawMineBlockWithTxs([toBufferedTransaction(secondSign)]);

    const keys = await createRandomAccountsWithFunds(3, 1e10);
    const multisigTx = wallet.signTransaction(
      new MultiSignatureTx({
        multisignature: {
          keysgroup: keys.map((k) => `+${k.account.publicKey}`),
          lifetime: 48,
          min: 2,
        },
      })
        .set('fee', systemModule.getFees().fees.multisignature)
        .set('timestamp', 1)
    );

    // from main account - no secondsignature - all multisig signatures
    multisigTx.signatures = keys.map((k) =>
      k.account.getSignatureOfTransaction(multisigTx)
    );

    await expect(
      initializer.rawMineBlockWithTxs([toBufferedTransaction(multisigTx)])
    ).rejectedWith('Missing second signature');

    // With second signature but old signatures that do not account the secondSignature
    multisigTx.signSignature = secondWallet.getSignatureOfTransaction(
      multisigTx
    );
    await expect(
      initializer.rawMineBlockWithTxs([toBufferedTransaction(multisigTx)])
    ).rejectedWith('Failed to verify multisignature');

    // updating the signatures should work
    multisigTx.signatures = keys.map((k) =>
      k.account.getSignatureOfTransaction(multisigTx)
    );
    await expect(
      initializer.rawMineBlockWithTxs([toBufferedTransaction(multisigTx)])
    ).not.rejected;
  });

  it('should restore DB after blockRollback', async () => {
    const { keys, tx } = await createMultiSignAccount(
      wallet,
      [createRandomWallet(), createRandomWallet(), createRandomWallet()],
      3
    );

    await blocksSubChainModule.deleteLastBlock();
    const after = await accountsModule.getAccount({ address: wallet.address });
    const js = after.toPOJO();
    expect(js.multisignatures).eq(null);
    expect(js.u_multisignatures).eq(null);
    expect(js.multimin).eq(0);
    expect(js.u_multimin).eq(0);
    expect(js.u_multilifetime).eq(0);
    expect(js.multilifetime).eq(0);
  });

  // Tests multisig account modification.
  describe('with multisig', async () => {
    let keys: LiskWallet[];
    let keysOther: LiskWallet[];
    let anotherMultisig: LiskWallet;
    let accPOJO: any;
    beforeEach(async () => {
      const { wallet: w } = await createRandomAccountWithFunds(1e10);
      anotherMultisig = w;
      keys = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
      keysOther = [
        createRandomWallet(),
        createRandomWallet(),
        createRandomWallet(),
      ];
      await createMultiSignAccount(anotherMultisig, keysOther, 2);
      await createMultiSignAccount(wallet, keys, 3);
      const acc = await accountsModule.getAccount({ address: wallet.address });
      accPOJO = acc.toPOJO();
      expect(acc.isMultisignature()).true;
    });
    it('should successfully revert to nomultisig if deleteblock', async () => {
      await initializer.rawDeleteBlocks(1);
      const acc = await accountsModule.getAccount({ address: wallet.address });
      expect(acc.isMultisignature()).false;
      expect(acc.balance).eq(1e10);
      expect(acc.u_balance).eq(1e10);
      expect(acc.multisignatures).null;
      expect(acc.u_multisignatures).null;
      expect(acc.multilifetime).eq(0);
      expect(acc.multimin).eq(0);
      expect(acc.u_multimin).eq(0);
      expect(acc.u_multilifetime).eq(0);
    });
    describe('modification', () => {
      it('should allow new "create multisig" tx only if properly signed', async () => {
        const newWallets = [
          createRandomWallet(),
          createRandomWallet(),
          createRandomWallet(),
        ];
        const newKeys = [keys[0], keys[2], ...newWallets];
        const { tx, signatures } = createMultiSignTransactionWithSignatures(
          wallet,
          5,
          newKeys,
          48,
          {}
        );

        const bufTx = toBufferedTransaction(tx);
        await txModule.processIncomingTransactions([bufTx], null);
        await poolManager.processPool();

        // just the new keys. should keep readyness to false.
        for (const signature of signatures.map((s) => Buffer.from(s, 'hex'))) {
          await multisigModule.onNewSignature({
            signature,
            transaction: tx.id,
            relays: 3,
          });
          expect(txPool.pending.getPayload(bufTx).ready).false;
        }

        // add the missing keys[1] and should change to readyness true
        await multisigModule.onNewSignature({
          signature: Buffer.from(keys[1].getSignatureOfTransaction(tx), 'hex'),
          transaction: bufTx.id,
          relays: 3,
        });
        expect(txPool.pending.getPayload(bufTx).ready).true;
        await poolManager.processPool();

        await initializer.rawMineBlocks(1);

        // check accounts data reflects new multi stuff.
        const acc = await accountsModule.getAccount({ address: tx.senderId });
        const untouchedAcc = await accountsModule.getAccount({
          address: anotherMultisig.address,
        });

        expect(acc.multisignatures).to.be.deep.eq(
          newKeys.map((k) => k.publicKey)
        );
        expect(acc.u_multisignatures).to.be.deep.eq(
          newKeys.map((k) => k.publicKey)
        );
        expect(acc.multimin).eq(5);
        expect(acc.u_multimin).eq(5);
        expect(acc.multilifetime).eq(48);
        expect(acc.u_multilifetime).eq(48);

        // Check untouchedAcc didnt get touched.
        expect(untouchedAcc.multisignatures).deep.eq(
          keysOther.map((k) => k.publicKey)
        );
        expect(untouchedAcc.u_multisignatures).deep.eq(
          keysOther.map((k) => k.publicKey)
        );
        expect(untouchedAcc.multimin).eq(2);
        expect(untouchedAcc.u_multimin).eq(2);
        expect(untouchedAcc.multilifetime).eq(24);
        expect(untouchedAcc.u_multilifetime).eq(24);
      });
      it('should allow modification if properly signed within block', async () => {
        const newWallets = [
          createRandomWallet(),
          createRandomWallet(),
          createRandomWallet(),
        ];
        const newKeys = [keys[0], keys[2], ...newWallets];
        const { tx, signatures } = createMultiSignTransactionWithSignatures(
          wallet,
          2,
          newKeys,
          48,
          {}
        );

        const bufTx = toBufferedTransaction(tx);
        bufTx.signatures = [];
        for (const signature of signatures) {
          bufTx.signatures.push(Buffer.from(signature, 'hex'));
          await expect(initializer.rawMineBlockWithTxs([bufTx])).rejectedWith(
            `MultiSig Transaction ${tx.id} is not ready`
          );
        }
        // try fake signature from randomWallet
        bufTx.signatures.push(
          Buffer.from(createRandomWallet().getSignatureOfTransaction(tx), 'hex')
        );
        await expect(initializer.rawMineBlockWithTxs([bufTx])).rejectedWith(
          'Failed to verify multisignature'
        );

        // try to include valid signatures with an external ^^ wallet.
        bufTx.signatures.push(
          Buffer.from(keys[1].getSignatureOfTransaction(tx), 'hex')
        );
        await expect(initializer.rawMineBlockWithTxs([bufTx])).rejectedWith(
          'Failed to verify multisignature'
        );

        // verify that tx can be included if signatures are ok.
        bufTx.signatures.splice(bufTx.signatures.length - 2, 1);
        await initializer.rawMineBlockWithTxs([bufTx]);
      });

      it('modification with requesterPublicKey is allowed only if properly signed.', async () => {
        const newWallets = [
          createRandomWallet(),
          createRandomWallet(),
          createRandomWallet(),
        ];
        const newKeys = [keys[0], keys[2], ...newWallets];

        // Pretend requester exists. (otherwise it will fast fail and we want to go as deep as possible with the test)
        await createAndConfirmSendTransaction(
          1,
          1e9,
          getRandomDelegateWallet(),
          newWallets[0].address
        );

        // Craft base tx using newWallets[0] as requesterPublicKey
        const tx = newWallets[0].signTransaction(
          new MultiSignatureTx({
            multisignature: {
              keysgroup: newKeys.map((k) => `+${k.publicKey}`),
              lifetime: 49,
              min: 2,
            },
          })
            .set('fee', systemModule.getFees().fees.multisignature)
            .set('requesterPublicKey', newWallets[0].publicKey)
            .set('senderPublicKey', wallet.publicKey)
            .set('timestamp', 1)
        );
        tx.senderId = wallet.address;

        // Sign only with the new Keys (missing keys[1]) should fail
        tx.signatures = newKeys.map((k) => k.getSignatureOfTransaction(tx));
        await expect(
          initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
        ).rejectedWith(`Transaction ${tx.id} is not ready`);

        // it should reject if another unknown signature is added
        tx.signatures.push(createRandomWallet().getSignatureOfTransaction(tx));
        await expect(
          initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
        ).rejectedWith('Failed to verify multisignature');

        // Adding the missing keys[1] should still reject cause of previous key
        tx.signatures.push(keys[1].getSignatureOfTransaction(tx));
        await expect(
          initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
        ).rejectedWith('Failed to verify multisignature');

        // remove unknown wallet - tx should pass.
        tx.signatures.splice(tx.signatures.length - 2, 1);
        const b = await expect(
          initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
        ).not.rejected;

        // Check DB State.
        // Tx.
        const db = await TxModel.findById(tx.id);
        expect(db).exist;
        await txLogic.attachAssets([db]);
        expect(db.toTransport()).deep.eq({
          ...tx,
          height: b.height,
          rowId: db.rowId,
          recipientId: null,
          signSignature: null,
          blockId: b.id,
          confirmations: 1,
        });

        // account db state
        const acc = await accountsModule.getAccount({
          address: wallet.address,
        });
        expect(acc.multisignatures).deep.eq(newKeys.map((k) => k.publicKey));
        expect(acc.multimin).deep.eq(2);
        expect(acc.multilifetime).deep.eq(49);
        expect(acc.u_multisignatures).deep.eq(newKeys.map((k) => k.publicKey));
        expect(acc.u_multimin).deep.eq(2);
        expect(acc.u_multilifetime).deep.eq(49);
      });
      describe('onSuccessful Override', () => {
        let newKeys: LiskWallet[];
        beforeEach(async () => {
          newKeys = [
            createRandomWallet(),
            createRandomWallet(),
            createRandomWallet(),
          ];
          const { tx, signatures } = createMultiSignTransactionWithSignatures(
            wallet,
            3,
            newKeys,
            48,
            {}
          );
          const bufTx = toBufferedTransaction(tx);
          bufTx.signatures = signatures
            .concat(keys.map((k) => k.getSignatureOfTransaction(tx)))
            .map((s) => Buffer.from(s, 'hex'));
          const b = await initializer.rawMineBlockWithTxs([bufTx]);
          expect(b.numberOfTransactions).eq(1);
        });
        it('should not accept old keys for incoming transactions.', async () => {
          const sendTx = await createSendTransaction(
            wallet,
            wallet.address,
            systemModule.getFees().fees.send,
            {
              amount: 1,
              timestamp: 1,
            }
          );
          sendTx.signatures = keys.map((k) =>
            k.getSignatureOfTransaction(sendTx)
          );
          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(sendTx)])
          ).rejectedWith('Failed to verify multisignature');
        });
        it('should accept new keys for incoming transactions', async () => {
          const sendTx = await createSendTransaction(
            wallet,
            wallet.address,
            systemModule.getFees().fees.send,
            {
              amount: 1,
              timestamp: 1,
            }
          );
          sendTx.signatures = newKeys.map((k) =>
            k.getSignatureOfTransaction(sendTx)
          );
          const b = await initializer.rawMineBlockWithTxs([
            toBufferedTransaction(sendTx),
          ]);
          expect(b.numberOfTransactions).eq(1);
          expect(b.transactions[0].id).eq(sendTx.id);
        });
        it('should restore account on block delete', async () => {
          await initializer.rawDeleteBlocks(1);
          const acc = await accountsModule.getAccount({
            address: wallet.address,
          });
          expect(acc.toPOJO()).deep.eq({ ...accPOJO, blockId: '0' });
          expect(acc.multisignatures).deep.eq(keys.map((k) => k.publicKey));
          expect(acc.u_multisignatures).deep.eq(keys.map((k) => k.publicKey));
          expect(acc.multilifetime).eq(24);
          expect(acc.u_multilifetime).eq(24);
          expect(acc.multimin).eq(3);
          expect(acc.u_multimin).eq(3);
        });
      });
    });

    describe('block with tx ...', () => {
      describe('from sender', () => {
        let tx: ITransaction<any>;
        beforeEach(() => {
          tx = anotherMultisig.signTransaction(
            new SendTx()
              .set('senderPublicKey', anotherMultisig.publicKey)
              .set('recipientId', '1R')
              .set('fee', systemModule.getFees().fees.send)
              .set('amount', 100)
              .set('timestamp', 1)
          );
          tx.signatures = [];
        });
        it('should be rejected if no signatures provided', async () => {
          delete tx.signatures;
          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).rejectedWith(`Transaction ${tx.id} is not ready`);
        });
        it('should be rejected if not enough signatures provided', async () => {
          tx.signatures = [keysOther[0].getSignatureOfTransaction(tx)];
          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).rejectedWith(`Transaction ${tx.id} is not ready`);
        });
        it('should be accepted if enough signatures provided', async () => {
          tx.signatures = [
            keysOther[0].getSignatureOfTransaction(tx),
            keysOther[1].getSignatureOfTransaction(tx),
          ];

          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).not.rejected;
        });
        it('should be accepted even  fi more than enough signatures provided', async () => {
          tx.signatures = [
            keysOther[0].getSignatureOfTransaction(tx),
            keysOther[1].getSignatureOfTransaction(tx),
            keysOther[2].getSignatureOfTransaction(tx),
          ];

          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).not.rejected;
        });
        it('should be rejected if all necessary signatures provided but an unknown one added', async () => {
          tx.signatures = [
            keysOther[0].getSignatureOfTransaction(tx),
            keysOther[1].getSignatureOfTransaction(tx),
            keys[2].getSignatureOfTransaction(tx),
          ];
          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).rejectedWith('Failed to verify multisignature');
        });
      });
      describe('from requesterPublicKey', () => {
        let tx: ITransaction<any>;
        beforeEach(() => {
          tx = keysOther[0].signTransaction(
            new SendTx()
              .set('senderPublicKey', anotherMultisig.publicKey)
              .set('recipientId', '1R')
              .set('requesterPublicKey', keysOther[0].publicKey)
              .set('fee', systemModule.getFees().fees.send)
              .set('amount', 100)
              .set('timestamp', 1)
          );
          tx.senderId = anotherMultisig.address;
          tx.signatures = [];
        });
        it('should be rejected if no sigs', async () => {
          tx.signatures = [];
          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).rejectedWith(`Transaction ${tx.id} is not ready`);
        });
        it('should be rejected if not enough signatures', async () => {
          tx.signatures = [keysOther[1].getSignatureOfTransaction(tx)];
          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).rejectedWith(`Transaction ${tx.id} is not ready`);
        });
        it('should be accepted if enough signatures', async () => {
          tx.signatures = [
            keysOther[1].getSignatureOfTransaction(tx),
            keysOther[2].getSignatureOfTransaction(tx),
          ];
          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).not.rejected;
        });
        it('should be accepted if enough signatures and one is from requester', async () => {
          tx.signatures = [
            keysOther[0].getSignatureOfTransaction(tx),
            keysOther[1].getSignatureOfTransaction(tx),
          ];

          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).not.rejected;
        });
        it('should be rejected if requesterPublicKey is not a multisigparty', async () => {
          // keys is from wallet (which is not the same multisig account as `anotherMultisig` here)
          tx = keys[0].signTransaction(
            new SendTx()
              .set('senderPublicKey', anotherMultisig.publicKey)
              .set('recipientId', '1R')
              .set('requesterPublicKey', keys[0].publicKey)
              .set('fee', systemModule.getFees().fees.send)
              .set('amount', 100)
              .set('timestamp', 1)
          );
          tx.senderId = anotherMultisig.address;

          // properly sign the tx.
          tx.signatures = [
            keysOther[0].getSignatureOfTransaction(tx),
            keysOther[1].getSignatureOfTransaction(tx),
          ];

          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).rejectedWith('Account does not belong to multisignature group');
        });
        it('should not get rejected if requesterPublicKey has second signature enabled and not provided', async () => {
          const secondWallet = createRandomWallet();
          // Send money to requester so that it can register second sign tx
          await createAndConfirmSendTransaction(
            1,
            1e10,
            getRandomDelegateWallet(),
            keysOther[0].address
          );
          await createSecondSignTransaction(
            1,
            keysOther[0],
            secondWallet.publicKey
          );

          // should fail even if signatures are there.
          tx.signatures = [
            keysOther[0].getSignatureOfTransaction(tx),
            keysOther[1].getSignatureOfTransaction(tx),
          ];
          await expect(
            initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)])
          ).not.rejected;
          //
          // // add second signature and recompute multisignature signers's signature.
          // tx.signSignature = secondWallet.getSignatureOfTransaction(tx);
          // tx.signatures    = [
          //   keysOther[0].getSignatureOfTransaction(tx),
          //   keysOther[1].getSignatureOfTransaction(tx),
          // ];
          // await expect(initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)]))
          //   .not.rejected;
        });
      });
    });
  });
});
