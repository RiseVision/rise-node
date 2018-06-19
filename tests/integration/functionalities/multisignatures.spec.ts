import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as supertest from 'supertest';
import initializer from '../common/init';
import {
  createMultiSignAccount,
  createMultiSignTransactionWithSignatures,
  createRandomAccountWithFunds,
  createRandomWallet,
} from '../common/utils';
import { LiskWallet } from 'dpos-offline';
import {
  IAccountsModule,
  IBlocksModule,
  IBlocksModuleChain, IMultisignaturesModule, ISystemModule,
  ITransactionsModule
} from '../../../src/ioc/interfaces/modules';
import { TransactionsModel } from '../../../src/models';
import { Symbols } from '../../../src/ioc/symbols';
import { ITransactionLogic, ITransactionPoolLogic } from '../../../src/ioc/interfaces/logic';
import { createSendTransaction, toBufferedTransaction } from '../../utils/txCrafter';

chai.use(chaiAsPromised);

describe('functionalities.multisignature', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  let wallet: LiskWallet;

  let accountsModule: IAccountsModule;
  let blocksModule: IBlocksModule;
  let blocksSubChainModule: IBlocksModuleChain;
  let txModule: ITransactionsModule;
  let multisigModule: IMultisignaturesModule;
  let systemModule: ISystemModule;
  let txPool: ITransactionPoolLogic;
  let txLogic: ITransactionLogic;

  let TxModel: typeof TransactionsModel;
  beforeEach(async () => {
    const {wallet: w} = await createRandomAccountWithFunds(1e10);
    wallet            = w;

    TxModel              = initializer.appManager.container.get(Symbols.models.transactions);
    accountsModule       = initializer.appManager.container.get(Symbols.modules.accounts);
    blocksModule         = initializer.appManager.container.get(Symbols.modules.blocks);
    blocksSubChainModule = initializer.appManager.container.get(Symbols.modules.blocksSubModules.chain);
    multisigModule       = initializer.appManager.container.get(Symbols.modules.multisignatures);
    txModule             = initializer.appManager.container.get(Symbols.modules.transactions);
    systemModule         = initializer.appManager.container.get(Symbols.modules.system);
    txLogic              = initializer.appManager.container.get(Symbols.logic.transaction);
    txPool               = initializer.appManager.container.get(Symbols.logic.transactionPool);
  });
  it('should create a multisig account', async () => {
    const {keys, tx} = await createMultiSignAccount(
      wallet,
      [createRandomWallet(), createRandomWallet(), createRandomWallet()],
      3
    );

    const dbTX = await TxModel.findById(tx.id);
    console.log(dbTX.toTransport(blocksModule))
    expect(dbTX).exist;
  });

  it('should restore DB after blockRollback', async () => {
    const {keys, tx} = await createMultiSignAccount(
      wallet,
      [createRandomWallet(), createRandomWallet(), createRandomWallet()],
      3
    );

    await blocksSubChainModule.deleteLastBlock();
    const after = await accountsModule.getAccount({address: wallet.address});
    const js    = after.toPOJO();
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
      const {wallet: w} = await createRandomAccountWithFunds(1e10);
      anotherMultisig   = w;
      keys              = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
      keysOther         = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
      await createMultiSignAccount(anotherMultisig, keysOther, 2);
      await createMultiSignAccount(wallet, keys, 3);
      const acc = await accountsModule.getAccount({address: wallet.address});
      accPOJO   = acc.toPOJO();
      expect(acc.isMultisignature()).true;
    });
    it('should successfully revert to nomultisig if deleteblock', async () => {
      await initializer.rawDeleteBlocks(1);
      const acc = await accountsModule.getAccount({address: wallet.address});
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
        const newWallets       = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
        const newKeys          = [keys[0], keys[2], ...newWallets];
        const {tx, signatures} = createMultiSignTransactionWithSignatures(
          wallet,
          5,
          newKeys,
          48,
          {}
        );

        const bufTx = toBufferedTransaction(tx);
        await txModule.processUnconfirmedTransaction(bufTx, false);
        await txPool.processBundled();
        await txModule.fillPool();

        // just the new keys. should keep readyness to false.
        for (const signature of signatures) {
          await multisigModule.processSignature({signature, transaction: tx.id});
          expect(txPool.multisignature.getPayload(bufTx).ready).false;
        }

        // add the missing keys[1] and should change to readyness true
        await multisigModule.processSignature({
          signature  : keys[1]
            .getSignatureOfTransaction(tx),
          transaction: bufTx.id,
        });
        expect(txPool.multisignature.getPayload(bufTx).ready).true;
        await txPool.processBundled();
        await txModule.fillPool();

        await initializer.rawMineBlocks(1);

        // check accounts data reflects new multi stuff.
        const acc          = await accountsModule.getAccount({address: tx.senderId});
        const untouchedAcc = await accountsModule.getAccount({address: anotherMultisig.address});

        expect(acc.multisignatures).to.be.deep.eq(newKeys.map((k) => k.publicKey));
        expect(acc.u_multisignatures).to.be.deep.eq(newKeys.map((k) => k.publicKey));
        expect(acc.multimin).eq(5);
        expect(acc.u_multimin).eq(5);
        expect(acc.multilifetime).eq(48);
        expect(acc.u_multilifetime).eq(48);

        // Check untouchedAcc didnt get touched.
        expect(untouchedAcc.multisignatures).deep.eq(keysOther.map((k) => k.publicKey));
        expect(untouchedAcc.u_multisignatures).deep.eq(keysOther.map((k) => k.publicKey));
        expect(untouchedAcc.multimin).eq(2);
        expect(untouchedAcc.u_multimin).eq(2);
        expect(untouchedAcc.multilifetime).eq(24);
        expect(untouchedAcc.u_multilifetime).eq(24);
      });
      it('should allow modification if properly signed within block', async () => {
        const newWallets       = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
        const newKeys          = [keys[0], keys[2], ...newWallets];
        const {tx, signatures} = createMultiSignTransactionWithSignatures(
          wallet,
          5,
          newKeys,
          48,
          {}
        );

        const bufTx = toBufferedTransaction(tx);
        bufTx.signatures = [];
        for (const signature of signatures) {
          bufTx.signatures.push(signature);
          await expect(initializer.rawMineBlockWithTxs([bufTx]))
            .rejectedWith(`Transaction ${tx.id} is not ready`);
        }
        // try fake signature from randomWallet
        bufTx.signatures.push(createRandomWallet().getSignatureOfTransaction(tx));
        await expect(initializer.rawMineBlockWithTxs([bufTx]))
          .rejectedWith('Failed to verify multisignature');

        // try to include valid signatures with an external ^^ wallet.
        bufTx.signatures.push(keys[1].getSignatureOfTransaction(tx));
        await expect(initializer.rawMineBlockWithTxs([bufTx]))
          .rejectedWith('Failed to verify multisignature');

        // verify that tx can be included if signatures are ok.
        bufTx.signatures.splice(bufTx.signatures.length - 2, 1);
        await initializer.rawMineBlockWithTxs([bufTx]);
      });
      describe('onSuccessful Override', () => {
        let newKeys: LiskWallet[];
        beforeEach(async () => {
          newKeys                = [createRandomWallet(), createRandomWallet(), createRandomWallet()];
          const {tx, signatures} = createMultiSignTransactionWithSignatures(
            wallet,
            3,
            newKeys,
            48,
            {}
          );
          const bufTx            = toBufferedTransaction(tx);
          bufTx.signatures       = signatures
            .concat(keys.map((k) => k.getSignatureOfTransaction(tx)));
          const b                = await initializer.rawMineBlockWithTxs([bufTx]);
          expect(b.numberOfTransactions).eq(1);
        });
        it('should not accept old keys for incoming transactions.', async () => {
          const sendTx      = await createSendTransaction(wallet, wallet.address, systemModule.getFees().fees.send, {
            amount   : 1,
            timestamp: 1
          });
          sendTx.signatures = keys.map((k) => k.getSignatureOfTransaction(sendTx));
          await expect(initializer.rawMineBlockWithTxs([toBufferedTransaction(sendTx)]))
            .rejectedWith('Failed to verify multisignature');
        });
        it('should accept new keys for incoming transactions', async () => {
          const sendTx      = await createSendTransaction(wallet, wallet.address, systemModule.getFees().fees.send, {
            amount   : 1,
            timestamp: 1
          });
          sendTx.signatures = newKeys.map((k) => k.getSignatureOfTransaction(sendTx));
          const b           = await initializer.rawMineBlockWithTxs([toBufferedTransaction(sendTx)]);
          expect(b.numberOfTransactions).eq(1);
          expect(b.transactions[0].id).eq(sendTx.id);
        });
        it('should restore account on block delete', async () => {
          await initializer.rawDeleteBlocks(1);
          const acc = await accountsModule.getAccount({address: wallet.address});
          expect(acc.toPOJO()).deep.eq({...accPOJO, blockId: '0'});
          expect(acc.multisignatures).deep.eq(keys.map((k) => k.publicKey));
          expect(acc.u_multisignatures).deep.eq(keys.map((k) => k.publicKey));
          expect(acc.multilifetime).eq(24);
          expect(acc.u_multilifetime).eq(24);
          expect(acc.multimin).eq(3);
          expect(acc.u_multimin).eq(3);
        });
      });
    })

  });
});