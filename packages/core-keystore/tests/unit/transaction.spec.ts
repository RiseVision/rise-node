import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import { Address, IBaseTransaction } from '@risevision/core-types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { toNativeTx } from '../../../core-transactions/tests/unit/utils/txCrafter';
import {
  createRandomV2Wallet,
  createRandomWallet,
} from '../../../rise/tests/integration/common/utils';
import { KeyStoreAsset, KeystoreTransaction } from '../../src';
import { KeystoreModel } from '../../src/models';
import { KeystoreTxSymbols } from '../../src/symbols';
import { createKeystoreTransaction } from '../utils/createTransaction';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('transaction', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: KeystoreTransaction;
  let model: typeof KeystoreModel;

  beforeEach(async () => {
    container = await createContainer([
      'core-keystore',
      'core',
      'core-accounts',
    ]);
    sandbox = sinon.createSandbox();
    instance = container.getNamed(
      TXSymbols.transaction,
      KeystoreTxSymbols.transaction
    );
    model = container.getNamed(ModelSymbols.model, KeystoreTxSymbols.model);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('serialization/deserialization', () => {
    it('should properly serialize and deserialize bytes', () => {
      const tests = [
        {
          acc: createRandomWallet(),
          key: 'meow',
          value: Buffer.alloc(128).fill('a'),
        },
        {
          acc: createRandomV2Wallet(),
          key: 'SOMETHINGSUPERLONG',
          value: Buffer.alloc(128).fill('a'),
        },
      ];
      for (const t of tests) {
        const tx = createKeystoreTransaction(t.acc, t.key, t.value);
        const bytes = instance.fullBytes(toNativeTx(tx));
        const restored = instance.fromBytes(bytes);

        expect(bytes).deep.eq(instance.fullBytes(restored));
        expect(tx.asset).deep.eq(restored.asset);
      }
    });
  });
  describe('verify', () => {
    let tx: IBaseTransaction<KeyStoreAsset>;
    beforeEach(() => {
      tx = toNativeTx(
        createKeystoreTransaction(
          createRandomWallet(),
          'key',
          Buffer.from('value', 'utf8')
        )
      );
    });
    it('should fail if key is in invalid format', async () => {
      tx.asset.key = null;
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key Expected'
      );
      delete tx.asset.key;
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/ Missing required property: key'
      );
      tx.asset.key = '';
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key String'
      );
      tx.asset.key = 'Ba';
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key String'
      );
      tx.asset.key = 'bbb#';
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key String'
      );
      tx.asset.key = 'bbb.';
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key String'
      );
      tx.asset.key = '.bbb';
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key String'
      );
      tx.asset.key = '.';
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key String'
      );
      tx.asset.key = '...';
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key String'
      );
      tx.asset.key =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset Schema is not valid: #/key String'
      );
    });
    it('should allow good keys', async () => {
      tx.asset.key = 'a';
      await expect(instance.verify(tx, null)).to.not.rejected;
      tx.asset.key =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await expect(instance.verify(tx, null)).to.not.rejected;
      tx.asset.key = 'a.b.c.d';
      await expect(instance.verify(tx, null)).to.not.rejected;
    });
    it('should fail if value is empty', async () => {
      tx.asset.value = null;
      await expect(instance.verify(tx, null)).to.rejectedWith(
        '#/value Expected type object but found type null'
      );
      delete tx.asset.value;
      await expect(instance.verify(tx, null)).to.rejectedWith(
        '#/ Missing required property: value'
      );
      tx.asset.value = Buffer.alloc(0);
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset value cannot be empty'
      );
    });
    it('should fail if value is too long but not if it meets the max size', async () => {
      tx.asset.value = Buffer.alloc(513);
      await expect(instance.verify(tx, null)).to.rejectedWith(
        'Asset value cannot exceed max length'
      );
      tx.asset.value = Buffer.alloc(512);
      await expect(instance.verify(tx, null)).to.not.rejected;
    });
    it('should fail if value is not buf', async () => {
      tx.asset.value = 'banana' as any;
      await expect(instance.verify(tx, null)).to.rejectedWith('#/value');
    });
  });
});
