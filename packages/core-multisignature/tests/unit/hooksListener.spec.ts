import { ITransactionLogic, Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { TxReadyFilter } from '@risevision/core-transactions';
import {
  createRandomTransaction,
  fromBufferedTransaction,
  toBufferedTransaction,
} from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { IBaseTransaction } from '@risevision/core-types';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { createTransactionFromOBJ } from 'dpos-offline/dist/es5/utils/txFactory';
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
  let utils: MultiSigUtils;
  let sandbox: SinonSandbox;
  let txReadySpy: SinonSpy;
  let hookSystem: WordPressHookSystem;
  let tx: ITransaction<any>;
  let bufTX: IBaseTransaction<any>;
  let AccountsModel: typeof AccountsModelWithMultisig;
  let sender: AccountsModelWithMultisig;
  let wallet: LiskWallet;
  let multisigners: LiskWallet[];
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
    bufTX = toBufferedTransaction(tx);
    wallet = new LiskWallet('theWallet', 'R');
    multisigners = new Array(5)
      .fill(null)
      .map(() => new LiskWallet(uuid.v4(), 'R'));
    sender = new AccountsModel({
      address: wallet.address,
      publicKey: Buffer.from(wallet.publicKey, 'hex'),
      balance: 1e10,
      u_balance: 1e10,
      multilifetime: 10,
      multisignatures: multisigners.map((m) => m.publicKey),
      multimin: 4,
    });
  });

  it('should call txReadyStub', async () => {
    await hookSystem.apply_filters(TxReadyFilter.name, true, bufTX, sender);
    expect(txReadySpy.calledOnce).is.true;
  });

  it('should return true', async () => {
    const account = new LiskWallet('meow', 'R');
    const account2 = new LiskWallet('meow2', 'R');
    sender.multisignatures = [account.publicKey, account2.publicKey];
    sender.multilifetime = 24;
    sender.multimin = 2;
    bufTX.signatures = [
      Buffer.from(account.getSignatureOfTransaction(tx), 'hex'),
      Buffer.from(account2.getSignatureOfTransaction(tx), 'hex'),
    ];
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, true, bufTX, sender)
    ).true;

    sender.multimin = 1;
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, true, bufTX, sender)
    ).true;
  });
  it('should return false', async () => {
    const account = new LiskWallet('meow', 'R');
    const account2 = new LiskWallet('meow2', 'R');
    sender.multisignatures = [account.publicKey, account2.publicKey];
    sender.multilifetime = 24;
    sender.multimin = 2;
    bufTX.signatures = [
      Buffer.from(account.getSignatureOfTransaction(tx), 'hex'),
    ];
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, true, bufTX, sender)
    ).false;

    // should not return true if provided payload is already false.
    bufTX.signatures.push(
      Buffer.from(account2.getSignatureOfTransaction(tx), 'hex')
    );
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, true, bufTX, sender)
    ).true; // just to make sure tx is now valid
    // Real check ->
    expect(
      await hookSystem.apply_filters(TxReadyFilter.name, false, bufTX, sender)
    ).false;
  });

  describe('txVerify through txLogic.', () => {
    let txLogic: ITransactionLogic;
    let requester: AccountsModelWithMultisig;

    function signMultiSigTxRequester(r: LiskWallet) {
      tx.senderPublicKey = wallet.publicKey;
      tx.requesterPublicKey = r.publicKey;
      delete tx.id;
      delete tx.signature;
      const txOBJ = createTransactionFromOBJ(tx);
      txOBJ.signature = txOBJ.createSignature(r.privKey);
      const toRet = toBufferedTransaction({
        ...txOBJ.toObj(),
        senderId: wallet.address,
      });
      toRet.signatures = multisigners
        .map((m) => m.getSignatureOfTransaction(txOBJ))
        .map((s) => Buffer.from(s, 'hex'));
      return toRet;
    }

    beforeEach(() => {
      txLogic = container.get(Symbols.logic.transaction);
      requester = new AccountsModel({
        publicKey: Buffer.from(multisigners[0].publicKey, 'hex'),
      });
    });
    it('should allow signed tx', async () => {
      const ttx = signMultiSigTxRequester(multisigners[0]);
      // ttx.signatures; // already signed by all multisigners;
      await expect(txLogic.verify(ttx, sender, requester, 1)).to.not.rejected;
    });

    it('should reject tx if it is not ready', async () => {
      const ttx = signMultiSigTxRequester(multisigners[0]);
      ttx.signatures.splice(0, 2);
      await expect(txLogic.verify(ttx, sender, requester, 1)).to.rejectedWith(
        `MultiSig Transaction ${ttx.id} is not ready`
      );
    });
    it('should reject tx if requesetPublicKey and account is not multisign', async () => {
      sender.multilifetime = 0;
      const ttx = signMultiSigTxRequester(multisigners[0]);
      await expect(txLogic.verify(ttx, sender, requester, 1)).to.rejectedWith(
        'Account or requester account is not multisignature'
      );
    });
    it('should reject tx if requesterPublicKey, account is multisign but requester is null', async () => {
      const ttx = signMultiSigTxRequester(multisigners[0]);
      await expect(txLogic.verify(ttx, sender, null, 1)).to.rejectedWith(
        'Account or requester account is not multisignature'
      );
    });
    it('should reject if a signature is invalid', async () => {
      const ttx = signMultiSigTxRequester(multisigners[0]);
      ttx.signatures[0] = Buffer.from(
        `5e1${ttx.signatures[0].toString('hex').substr(3)}`,
        'hex'
      );
      await expect(txLogic.verify(ttx, sender, requester, 1)).to.rejectedWith(
        'Failed to verify multisignature'
      );
    });
    it('should reject if extra signature of non member provided', async () => {
      const ttx = signMultiSigTxRequester(multisigners[0]);
      ttx.signatures.push(
        Buffer.from(
          new LiskWallet('other').getSignatureOfTransaction(
            fromBufferedTransaction(ttx)
          ),
          'hex'
        )
      );
      await expect(txLogic.verify(ttx, sender, requester, 1)).to.rejectedWith(
        'Failed to verify multisignature'
      );
    });
    it('should reject if requesterPublicKey is not part of multisig group', async () => {
      const ttx = signMultiSigTxRequester(new LiskWallet('other'));
      await expect(txLogic.verify(ttx, sender, requester, 1)).to.rejectedWith(
        'Account does not belong to multisignature group'
      );
    });
    it('should reject if duplicated signature', async () => {
      const ttx = signMultiSigTxRequester(multisigners[0]);
      ttx.signatures.push(ttx.signatures[0]);
      await expect(txLogic.verify(ttx, sender, requester, 1)).to.rejectedWith(
        'Encountered duplicate signature in transaction'
      );
    });
    describe('multisig registration', () => {
      let newMultiSigners: LiskWallet[];
      beforeEach(() => {
        newMultiSigners = multisigners
          .slice(0, 2)
          .concat(new Array(3).fill(null).map(() => new LiskWallet(uuid.v4())));
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
        const signedTX = wallet.signTransaction(tx);
        signedTX.asset.multisignature.keysgroup.push(1);
        const btx = toBufferedTransaction(signedTX);
        btx.id = txLogic.getId(btx);
        await expect(txLogic.verify(btx, sender, requester, 1)).to.rejectedWith(
          'Invalid member in keysgroup'
        );
      });
      it('should reject if multisignature.keysgroup has wrong pubkey');
      it('should reject if not signed by all members');
      it(
        'should not reject if signed by requester publickey adn account already was multisign'
      );
      it('should reject if signed by requester but account was NOT multisign', async () => {
        sender.multimin = 0;
        sender.multisignatures = [];
        sender.multilifetime = 0;
        const resTX = signMultiSigTxRequester(multisigners[0]);
        await expect(
          txLogic.verify(resTX, sender, requester, 1)
        ).to.rejectedWith('Account or requester account is not multisignature');
      });
    });
  });
});
