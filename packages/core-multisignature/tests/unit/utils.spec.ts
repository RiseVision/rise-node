import {
  ICrypto,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { TXSymbols } from '@risevision/core-transactions';
import {
  createRandomTransaction,
  toNativeTx,
} from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { IBaseTransaction } from '@risevision/core-types';
import { expect } from 'chai';
import { IKeypair, RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import * as uuid from 'uuid';
import { MultisigSymbols, MultiSigUtils } from '../../src';

// TODO: fill in these tests.
// tslint:disable no-unused-expression
describe('multisigUtils', () => {
  let container: Container;
  let crypto: ICrypto;
  let txLogic: ITransactionLogic;
  let instance: MultiSigUtils;
  beforeEach(async () => {
    container = await createContainer([
      'core-multisignature',
      'core',
      'core-helpers',
      'core-crypto',
    ]);
    instance = container.get(MultisigSymbols.utils);
    crypto = container.get(Symbols.generic.crypto);
    txLogic = container.get(TXSymbols.logic);
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
    let accounts: IKeypair[];
    beforeEach(() => {
      const t = createRandomTransaction();
      tx = toNativeTx(t);
      accounts = new Array(100)
        .fill(null)
        .map(() => RiseV2.deriveKeypair(uuid.v4()));
      tx.signatures = accounts.map((acc) =>
        crypto.sign(txLogic.getHash(tx), acc)
      );
    });
    it('should return false if tx is not signed by that pubKey', () => {
      expect(
        instance.isTxSignedByPubKey(tx, RiseV2.deriveKeypair('meow').publicKey)
      ).is.false;
    });
    it('should return true for all pubKey that signed the tx', () => {
      for (const account of accounts) {
        expect(instance.isTxSignedByPubKey(tx, account.publicKey)).is.true;
      }
    });
  });
});
