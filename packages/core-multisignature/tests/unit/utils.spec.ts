import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import {
  createRandomTransaction,
  toBufferedTransaction,
} from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { IBaseTransaction } from '@risevision/core-types';
import { expect } from 'chai';
import { LiskWallet } from 'dpos-offline';
import { Container } from 'inversify';
import * as uuid from 'uuid';
import { MultisigSymbols, MultiSigUtils } from '../../src';

// TODO: fill in these tests.
describe('multisigUtils', () => {
  let container: Container;
  let instance: MultiSigUtils;
  beforeEach(async () => {
    container = await createContainer([
      'core-multisignature',
      'core',
      'core-helpers',
      'core-crypto',
    ]);
    instance = container.get(MultisigSymbols.utils);
  });

  describe('txMultiSigReady', () => {
    it(
      'should return true if sender is not multisig and tx is not multisig registration'
    );
    describe('multisig registration', () => {
      it('should return false if ! all signatures in new multisig account');
      it(
        'should return false in several cases when account is already multisig'
      );
    });
    describe('normal tx', () => {
      it('should return false until min signatures');
    });
  });

  describe('isTxSignedByPubKey', () => {
    let tx: IBaseTransaction<any>;
    let accounts: LiskWallet[];
    beforeEach(() => {
      const t = createRandomTransaction();
      tx = toBufferedTransaction(t);
      accounts = new Array(100)
        .fill(null)
        .map(() => new LiskWallet(uuid.v4(), 'R'));
      tx.signatures = accounts
        .map((acc) => acc.getSignatureOfTransaction(t))
        .map((s) => Buffer.from(s, 'hex'));
    });
    it('should return false if tx is not signed by that pubKey', () => {
      expect(
        instance.isTxSignedByPubKey(
          tx,
          Buffer.from(new LiskWallet('meow').publicKey, 'hex')
        )
      ).is.false;
    });
    it('should return true for all pubKey that signed the tx', () => {
      for (const account of accounts) {
        expect(
          instance.isTxSignedByPubKey(tx, Buffer.from(account.publicKey, 'hex'))
        ).is.true;
      }
    });
  });
});
