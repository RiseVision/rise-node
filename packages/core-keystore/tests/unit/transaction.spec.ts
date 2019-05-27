import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import { Address } from '@risevision/core-types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { KeystoreTransaction } from '../../src';
import { KeystoreModel } from '../../src/models';
import { KeystoreTxSymbols } from '../../src/symbols';

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

  // describe('serialization/deserialization', () => {});
  // describe('assetBytes', () => {
  //   it('should encode/decode properly', () => {
  //   });
  // });
  //
  // describe('verify', () => {});
  //
  // describe('apply/undo', () => {});
  //
  // describe('attachAssets', () => {});
  //
  // describe('dbSave', () => {});
});
