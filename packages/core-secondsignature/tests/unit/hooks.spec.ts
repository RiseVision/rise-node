import { TXBytes, TXSymbols } from '@risevision/core-transactions';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { Container } from 'inversify';
import * as uuid from 'uuid';
import { IIdsHandler, Symbols } from '../../../core-interfaces/src';
import { ITransactionLogic } from '../../../core-interfaces/src/logic';
import { createContainer } from '../../../core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '../../../core-models/src/helpers';
import {
  createRandomTransaction,
  toBufferedTransaction,
} from '../../../core-transactions/tests/unit/utils/txCrafter';
import { AccountsModelWith2ndSign } from '../../src/AccountsModelWith2ndSign';

chai.use(chaiAsPromised);
describe('secondSignHooks', () => {
  let container: Container;
  let txLogic: ITransactionLogic;
  let sender: AccountsModelWith2ndSign;
  let senderWallet: LiskWallet;
  let secondSignWallet: LiskWallet;
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
    senderWallet = new LiskWallet(uuid.v4(), 'R');
    secondSignWallet = new LiskWallet(uuid.v4(), 'R');
    sender = new AccountsModel({
      address: senderWallet.address,
      balance: 10n ** 10n,
      publicKey: Buffer.from(senderWallet.publicKey, 'hex'),
      secondPublicKey: Buffer.from(secondSignWallet.publicKey, 'hex'),
      secondSignature: 1,
    });
    txLogic = container.get(Symbols.logic.transaction);
  });
  describe('transaction hooks', () => {
    let tx: ITransaction<any>;
    beforeEach(() => {
      tx = createRandomTransaction(senderWallet);
      // tx.signature = null;
    });
    it('should allow proper tx', async () => {
      tx = senderWallet.signTransaction(tx, secondSignWallet);
      // tx.id;
      await expect(txLogic.verify(toBufferedTransaction(tx), sender, 1)).not
        .rejected;
    });
    it('should reject with signSignature when account does not have one', async () => {
      sender.secondSignature = 0;
      sender.secondPublicKey = null;
      tx = senderWallet.signTransaction(tx, secondSignWallet);
      await expect(
        txLogic.verify(toBufferedTransaction(tx), sender, 1)
      ).rejectedWith(
        'Second Signature provided but account does not have one registered'
      );
    });
    it('should reject tx without signSignature when account have one', async () => {
      tx = senderWallet.signTransaction(tx);
      await expect(
        txLogic.verify(toBufferedTransaction(tx), sender, 1)
      ).rejectedWith('Missing second signature');
    });
    it('should reject tx if signSignature is not valid', async () => {
      tx = senderWallet.signTransaction(tx, secondSignWallet);
      tx.signSignature = new Array(128).fill('a').join('');
      const idsHandler = container.get<IIdsHandler>(Symbols.helpers.idsHandler);
      const txBytesHandler = container.get<TXBytes>(TXSymbols.txBytes);
      const btx: any = toBufferedTransaction(tx);
      btx.signSignature = Buffer.from(btx.signSignature, 'hex');
      btx.id = idsHandler.txIdFromBytes(
        txBytesHandler.fullBytes(btx)
      );
      await expect(txLogic.verify(btx, sender, 1)).rejectedWith(
        'Invalid second signature'
      );
    });
    it('should not complain if tx is not from a secondSign enabled sender', async () => {
      sender.secondPublicKey = null;
      sender.secondSignature = 0;
      tx = senderWallet.signTransaction(tx);
      await expect(txLogic.verify(toBufferedTransaction(tx), sender, 1)).not
        .rejected;
    });
  });

  describe('getAccountAPI', () => {
    it('should return second signature informations');
  });
});
