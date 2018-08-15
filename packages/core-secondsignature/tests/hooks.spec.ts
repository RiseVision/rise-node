import { Container } from 'inversify';
import * as uuid from 'uuid';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { createContainer } from '../../core-launchpad/tests/utils/createContainer';
import { ITransactionLogic } from '../../core-interfaces/src/logic';
import { AccountsModelWith2ndSign } from '../src/AccountsModelWith2ndSign';
import { ModelSymbols } from '../../core-models/src/helpers';
import { Symbols } from '../../core-interfaces/src';
import { LiskWallet } from 'dpos-offline';
import { IBaseTransaction } from '../../core-types/src';
import { createRandomTransaction, toBufferedTransaction } from '../../core-transactions/tests/utils/txCrafter';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';

chai.use(chaiAsPromised);
describe('secondSignHooks', () => {
  let container: Container;
  let txLogic: ITransactionLogic;
  let sender: AccountsModelWith2ndSign;
  let senderWallet: LiskWallet;
  let secondSignWallet: LiskWallet;
  let AccountsModel: typeof AccountsModelWith2ndSign;
  beforeEach(async () => {
    container = await createContainer(['core-secondsignature', 'core', 'core-helpers']);
    AccountsModel = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    senderWallet = new LiskWallet(uuid.v4(), 'R');
    secondSignWallet = new LiskWallet(uuid.v4(), 'R');
    sender = new AccountsModel({
      address: senderWallet.address,
      balance: 1e10,
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
      tx.signature = null;
    });
    it('should allow proper tx', async () => {
      tx = senderWallet.signTransaction(tx, secondSignWallet);
      await expect(txLogic.verify(toBufferedTransaction(tx), sender, null, 1))
        .not.rejected;
    });
    it('should reject with signSignature when account does not have one', async () => {
      sender.secondSignature = 0;
      sender.secondPublicKey = null;
      tx = senderWallet.signTransaction(tx, secondSignWallet);
      await expect(txLogic.verify(toBufferedTransaction(tx), sender, null, 1))
        .rejectedWith('Second Signature provided but account does not have one registered');
    });
    it('should reject tx without signSignature when account have one', async () => {
      tx = senderWallet.signTransaction(tx);
      await expect(txLogic.verify(toBufferedTransaction(tx), sender, null, 1))
        .rejectedWith('Missing second signature');
    });
    it('should reject tx if signSignature is not valid', async () => {
      tx = senderWallet.signTransaction(tx, secondSignWallet);
      tx.signSignature = new Array(128).fill('a').join('');
      tx.id = txLogic.getId(toBufferedTransaction(tx));
      await expect(txLogic.verify(toBufferedTransaction(tx), sender, null, 1))
        .rejectedWith('Invalid second signature');
    });
    it('should not complain if tx is not from a secondSign enabled sender', async () => {
      sender.secondPublicKey = null;
      sender.secondSignature = 0;
      tx = senderWallet.signTransaction(tx);
      await expect(txLogic.verify(toBufferedTransaction(tx), sender, null, 1))
        .not.rejected;
    });
  });

  describe('getAccountAPI', () => {
    it('should return second signature informations');
  });
});
