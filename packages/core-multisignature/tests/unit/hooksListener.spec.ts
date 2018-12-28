import {
  ICrypto,
  IIdsHandler,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { TxReadyFilter } from '@risevision/core-transactions';
import { TXBytes, TXSymbols } from '@risevision/core-transactions';
import {
  createRandomTransaction,
  toNativeTx,
} from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { IBaseTransaction } from '@risevision/core-types';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { IKeypair, RiseTransaction, RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { SinonSandbox, SinonSpy } from 'sinon';
import * as sinon from 'sinon';
import uuid = require('uuid');
import {
  AccountsModelWithMultisig,
  MultisigSymbols,
  MultiSigUtils,
} from '../../src';
import { MultisigHooksListener } from '../../src/hooks/hooksListener';

chai.use(chaiAsPromised);
// tslint:disable no-big-function object-literal-sort-keys no-unused-expression
describe('HooksListener', () => {
  let container: Container;
  let instance: MultisigHooksListener;
  let idsHandler: IIdsHandler;
  let txBytes: TXBytes;
  let crypto: ICrypto;
  let utils: MultiSigUtils;
  let sandbox: SinonSandbox;
  let txReadySpy: SinonSpy;
  let hookSystem: WordPressHookSystem;
  let tx: RiseTransaction<any>;
  let nativeTx: IBaseTransaction<any>;
  let AccountsModel: typeof AccountsModelWithMultisig;
  let sender: AccountsModelWithMultisig;
  let wallet: IKeypair;
  let multisigners: IKeypair[];
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-multisignature',
      'core',
      'core-helpers',
      'core-crypto',
    ]);
    instance = container.get(MultisigSymbols.hooksListener);
    hookSystem = container.get(Symbols.generic.hookSystem);
    utils = container.get(MultisigSymbols.utils);
    AccountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );
    txReadySpy = sandbox.spy(utils, 'txMultiSigReady');
    expect(instance).not.undefined;

    tx = createRandomTransaction();

    nativeTx = toNativeTx(tx);
    wallet = RiseV2.deriveKeypair('theWallet');
    multisigners = new Array(5)
      .fill(null)
      .map(() => RiseV2.deriveKeypair(uuid.v4()));
    sender = new AccountsModel({
      address: RiseV2.calcAddress(wallet.publicKey),
      publicKey: wallet.publicKey,
      balance: 10n ** 10n,
      u_balance: 10n ** 10n,
      multilifetime: 10,
      multisignatures: multisigners.map((m) => m.publicKey.toString('hex')),
      multimin: 4,
    });

    idsHandler = container.get(Symbols.helpers.idsHandler);
    txBytes = container.get(TXSymbols.txBytes);
    crypto = container.get(Symbols.generic.crypto);
  });

  it('should call txReadyStub', async () => {
    await hookSystem.apply_filters(TxReadyFilter.name, true, nativeTx, sender);
    expect(txReadySpy.calledOnce).is.true;
  });

  it('should return true', async () => {
    const account = RiseV2.deriveKeypair('meow');
    const account2 = RiseV2.deriveKeypair('meow2');
    sender.multisignatures = [
      account.publicKey.toString('hex'),
      account2.publicKey.toString('hex'),
    ];
    sender.multilifetime = 24;
    sender.multimin = 2;
    nativeTx.signatures = [
      RiseV2.txs.calcSignature(tx, account),
      RiseV2.txs.calcSignature(tx, account2),
    ];
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, true, nativeTx, sender)
    ).true;

    sender.multimin = 1;
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, true, nativeTx, sender)
    ).true;
  });
  it('should return false', async () => {
    const account = RiseV2.deriveKeypair('meow');
    const account2 = RiseV2.deriveKeypair('meow2');
    sender.multisignatures = [
      account.publicKey.toString('hex'),
      account2.publicKey.toString('hex'),
    ];
    sender.multilifetime = 24;
    sender.multimin = 2;
    nativeTx.signatures = [RiseV2.txs.calcSignature(tx, account)];
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, true, nativeTx, sender)
    ).false;

    // should not return true if provided payload is already false.
    nativeTx.signatures.push(RiseV2.txs.calcSignature(tx, account2));
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, true, nativeTx, sender)
    ).true; // just to make sure tx is now valid
    // Real check ->
    expect(
      await hookSystem.apply_filters(
        TxReadyFilter.name,
        false,
        nativeTx,
        sender
      )
    ).false;
  });

  describe('txVerify through txLogic.', () => {
    let txLogic: ITransactionLogic;

    function signMultiSigTxRequester() {
      tx.senderPublicKey = wallet.publicKey;
      delete tx.id;
      delete tx.signature;
      tx.signature = RiseV2.txs.calcSignature(tx, wallet);
      tx.senderId = RiseV2.calcAddress(wallet.publicKey);
      const id = RiseV2.txs.identifier(tx);
      tx.signatures = multisigners.map((m) =>
        RiseV2.txs.calcSignature(tx, m, {
          skipSignature: true,
          skipSecondSign: false,
        })
      );

      tx.id = RiseV2.txs.identifier(tx);
      expect(id).not.eq(tx.id);
      return tx;
    }

    beforeEach(() => {
      txLogic = container.get(Symbols.logic.transaction);
    });
    it('should allow signed tx', async () => {
      const ttx = signMultiSigTxRequester();
      // ttx.signatures; // already signed by all multisigners;
      await expect(txLogic.verify(toNativeTx(ttx), sender, 1)).to.not.rejected;
    });

    it('should reject tx if it is not ready', async () => {
      const ttx = signMultiSigTxRequester();
      ttx.signatures.splice(0, 2);
      await expect(txLogic.verify(toNativeTx(ttx), sender, 1)).to.rejectedWith(
        `MultiSig Transaction ${ttx.id} is not ready`
      );
    });
    it('should reject if a signature is invalid', async () => {
      const ttx = signMultiSigTxRequester();
      ttx.signatures[0] = Buffer.from(
        `5e1${ttx.signatures[0].toString('hex').substr(3)}`,
        'hex'
      ) as any;
      ttx.id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(toNativeTx(ttx)));
      await expect(txLogic.verify(toNativeTx(ttx), sender, 1)).to.rejectedWith(
        'Failed to verify multisignature'
      );
    });
    it('should reject if extra signature of non member provided', async () => {
      const ttx = signMultiSigTxRequester();
      ttx.signatures.push(
        RiseV2.txs.calcSignature(ttx, RiseV2.deriveKeypair('other'))
      );
      ttx.id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(toNativeTx(ttx)));
      await expect(txLogic.verify(toNativeTx(ttx), sender, 1)).to.rejectedWith(
        'Failed to verify multisignature'
      );
    });
    it('should reject if duplicated signature', async () => {
      const ttx = signMultiSigTxRequester();
      ttx.signatures.push(ttx.signatures[0]);
      ttx.id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(toNativeTx(ttx)));
      await expect(txLogic.verify(toNativeTx(ttx), sender, 1)).to.rejectedWith(
        'Encountered duplicate signature in transaction'
      );
    });
    describe('multisig registration', () => {
      let newMultiSigners: IKeypair[];
      beforeEach(() => {
        newMultiSigners = multisigners
          .slice(0, 2)
          .concat(
            new Array(3).fill(null).map(() => RiseV2.deriveKeypair(uuid.v4()))
          );
        tx.asset = {};
        tx.asset.multisignature = {
          min: 4,
          lifetime: 10,
          keysgroup: multisigners.map((m) => `+${m.publicKey}`),
        };
        tx.type = 4;
        tx.fee = 500000000;
        tx.amount = 0;
        tx.senderPublicKey = wallet.publicKey;
        delete tx.recipientId;
      });
      it('should reject if multisignature.keysgroup has non string members', async () => {
        tx.signature = RiseV2.txs.calcSignature(tx, wallet);
        tx.asset.multisignature.keysgroup.push(1);
        const btx = toNativeTx(tx);
        // btx.id = txLogic.getId(btx);
        btx.id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(btx));
        await expect(txLogic.verify(btx, sender, 1)).to.rejectedWith(
          'Invalid member in keysgroup'
        );
      });
      it('should reject if multisignature.keysgroup has wrong pubkey');
      it('should reject if not signed by all members');
      it(
        'should not reject if signed by requester publickey adn account already was multisign'
      );
    });
  });
});
