import { TXBytes, TXSymbols } from '@risevision/core-transactions';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { IKeypair, RiseTransaction, RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import { As } from 'type-tagger';
import * as uuid from 'uuid';
import { IIdsHandler, Symbols } from '../../../core-interfaces/src';
import { ITransactionLogic } from '../../../core-interfaces/src/logic';
import { createContainer } from '../../../core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '../../../core-models/src/helpers';
import {
  createRandomTransaction,
  toNativeTx,
} from '../../../core-transactions/tests/unit/utils/txCrafter';
import { AccountsModelWith2ndSign } from '../../src/AccountsModelWith2ndSign';

chai.use(chaiAsPromised);
describe('secondSignHooks', () => {
  let container: Container;
  let txLogic: ITransactionLogic;
  let sender: AccountsModelWith2ndSign;
  let senderWallet: IKeypair;
  let secondSignWallet: IKeypair;
  let AccountsModel: typeof AccountsModelWith2ndSign;
  beforeEach(async () => {
    container = await createContainer([
      'core-secondsignature',
      'core',
      'core-helpers',
      'core-crypto',
    ]);
    AccountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );
    senderWallet = RiseV2.deriveKeypair(uuid.v4());
    secondSignWallet = RiseV2.deriveKeypair(uuid.v4());
    sender = new AccountsModel({
      address: RiseV2.calcAddress(senderWallet.publicKey),
      balance: 10n ** 10n,
      publicKey: senderWallet.publicKey,
      secondPublicKey: secondSignWallet.publicKey,
      secondSignature: 1,
    });
    txLogic = container.get(Symbols.logic.transaction);
  });
  describe('transaction hooks', () => {
    let tx: RiseTransaction<any>;
    beforeEach(() => {
      tx = createRandomTransaction(senderWallet);
      // tx.signature = null;
    });
    it('should allow proper tx', async () => {
      tx.signSignature = RiseV2.txs.calcSignature(tx, secondSignWallet, {
        skipSecondSign: false,
        skipSignature: true,
      });
      // tx.id;
      await expect(txLogic.verify(toNativeTx(tx), sender, 1)).not.rejected;
    });
    it('should reject with signSignature when account does not have one', async () => {
      sender.secondSignature = 0;
      sender.secondPublicKey = null;
      tx.signSignature = RiseV2.txs.calcSignature(tx, secondSignWallet);
      await expect(txLogic.verify(toNativeTx(tx), sender, 1)).rejectedWith(
        'Second Signature provided but account does not have one registered'
      );
    });
    it('should reject tx without signSignature when account have one', async () => {
      await expect(txLogic.verify(toNativeTx(tx), sender, 1)).rejectedWith(
        'Missing second signature'
      );
    });
    it('should reject tx if signSignature is not valid', async () => {
      tx.signSignature = Buffer.from(
        new Array(128).fill('a').join(''),
        'hex'
      ) as Buffer & As<'signature'>;
      const idsHandler = container.get<IIdsHandler>(Symbols.helpers.idsHandler);
      const txBytesHandler = container.get<TXBytes>(TXSymbols.txBytes);
      const btx: any = toNativeTx(tx);
      btx.signSignature = Buffer.from(btx.signSignature, 'hex');
      btx.id = idsHandler.calcTxIdFromBytes(txBytesHandler.fullBytes(btx));
      await expect(txLogic.verify(btx, sender, 1)).rejectedWith(
        'Invalid second signature'
      );
    });
    it('should not complain if tx is not from a secondSign enabled sender', async () => {
      sender.secondPublicKey = null;
      sender.secondSignature = 0;
      await expect(txLogic.verify(toNativeTx(tx), sender, 1)).not.rejected;
    });
  });

  describe('getAccountAPI', () => {
    it('should return second signature informations');
  });
});
