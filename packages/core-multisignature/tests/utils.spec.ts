import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { Container } from 'inversify';
import { expect } from 'chai';
import * as uuid from 'uuid';
import { MultiSigUtils } from '../src/utils';
import { MultisigSymbols } from '../src/helpers';
import { IBaseTransaction } from '@risevision/core-types';
import { createRandomTransaction, toBufferedTransaction } from '@risevision/core-transactions/tests/utils/txCrafter';
import { LiskWallet } from 'dpos-offline';

// TODO: fill in these tests.
describe('multisigUtils', () => {
  let container: Container;
  let instance: MultiSigUtils;
  beforeEach(async () => {
    container = await createContainer(['core-multisignature', 'core', 'core-helpers']);
    instance  = container.get(MultisigSymbols.utils);
  });

  describe('txMultiSigReady', () => {
    it('should return true if sender is not multisig and tx is not multisig registration');
    describe('multisig registration', () => {
      it('should return false if ! all signatures in new multisig account');
      it('should return false in several cases when account is already multisig');
    });
    describe('normal tx', () => {
      it('should return false until min signatures');
    });
  });

  describe('isTxSignedByPubKey', () => {
    let tx: IBaseTransaction<any>;
    let accounts: LiskWallet[];
    beforeEach(() => {
      let t         = createRandomTransaction();
      tx            = toBufferedTransaction(t);
      accounts      = new Array(100).fill(null)
        .map(() => new LiskWallet(uuid.v4(), 'R'));
      tx.signatures = accounts.map((acc) => acc.getSignatureOfTransaction(t));
    });
    it('should return false if tx is not signed by that pubKey', () => {
      expect(instance.isTxSignedByPubKey(tx, Buffer.from(new LiskWallet('meow').publicKey, 'hex')))
        .is.false;
    });
    it('should return true for all pubKey that signed the tx', () => {
      for (const account of accounts) {
        expect(instance.isTxSignedByPubKey(tx, Buffer.from(account.publicKey, 'hex')))
          .is.true;
      }
    });
  });
});