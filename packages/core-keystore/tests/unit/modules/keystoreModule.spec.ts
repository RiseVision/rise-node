import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { Address } from '@risevision/core-types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { KeystoreModel } from '../../../src/models';
import { KeystoreModule } from '../../../src/modules';
import { KeystoreTxSymbols } from '../../../src/symbols';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('modules/keystoreModule', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: KeystoreModule;
  let model: typeof KeystoreModel;

  beforeEach(async () => {
    container = await createContainer([
      'core-keystore',
      'core',
      'core-accounts',
    ]);
    sandbox = sinon.createSandbox();
    instance = container.get(KeystoreTxSymbols.module);
    model = container.getNamed(ModelSymbols.model, KeystoreTxSymbols.model);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('getAcctKeyValue', () => {
    it('should return current acct key value using getAllAcctValues', async () => {
      sandbox.stub(instance, 'getAllAcctValues').resolves({
        current: {
          another: 'value',
          thaKey: 'thaValue',
        },
      });

      let res = await instance.getAcctKeyValue('1R' as Address, 'thaKey');

      expect(res).eq('thaValue');

      res = await instance.getAcctKeyValue('1R' as Address, 'missing');
      expect(res).is.undefined;
    });
  });
  describe('getAcctKeyHistory', () => {
    it('should return history using getAllAcctValues', async () => {
      sandbox.stub(instance, 'getAllAcctValues').resolves({
        history: {
          thaKey: ['one', 'two'],
        },
      });

      let res = await instance.getAcctKeyHistory('1R' as Address, 'thaKey');

      expect(res).deep.eq(['one', 'two']);

      res = await instance.getAcctKeyHistory('1R' as Address, 'missing');
      expect(res).is.undefined;
    });
  });
  describe('getAllAcctValues', () => {
    const SQLRes = [
      {
        key: 'first',
        transactionId: 'idOne',
        'tx.height': 1,
        value: 'first1Val',
      },
      {
        key: 'second',
        transactionId: 'idTwo',
        'tx.height': 2,
        value: 'second1Val',
      },
      {
        key: 'first',
        transactionId: 'idThree',
        'tx.height': 3,
        value: 'first2Val',
      },
      {
        key: 'second',
        transactionId: 'idFourth',
        'tx.height': 5,
        value: 'second2Val',
      },
      {
        key: 'third',
        transactionId: 'idFifth',
        'tx.height': 3,
        value: 'thirdVal',
      },
    ];
    let stub: SinonStub;
    beforeEach(() => {
      stub = sandbox.stub(model, 'findAll').resolves(SQLRes);
    });

    it('should compute current properly', async () => {
      const res = await instance.getAllAcctValues('meow' as Address);
      expect(res.current).deep.eq({
        first: 'first2Val',
        second: 'second2Val',
        third: 'thirdVal',
      });
    });
    it('should compute history properly with proper order', async () => {
      const res = await instance.getAllAcctValues('meow' as Address);
      expect(res.history).deep.eq({
        first: [
          { height: 3, id: 'idThree', value: 'first2Val' },
          { height: 1, id: 'idOne', value: 'first1Val' },
        ],
        second: [
          { height: 5, id: 'idFourth', value: 'second2Val' },
          { height: 2, id: 'idTwo', value: 'second1Val' },
        ],
        third: [{ height: 3, id: 'idFifth', value: 'thirdVal' }],
      });
    });
  });
});
