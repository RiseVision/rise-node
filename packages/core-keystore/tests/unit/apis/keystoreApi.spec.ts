import { APISymbols } from '@risevision/core-apis';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { Address, ISystemModule, Symbols } from '@risevision/core-types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { KeystoreAPI } from '../../../src/apis';
import { KeystoreTxSymbols } from '../../../src/symbols';
import { KeystoreModule } from '../../../src/modules';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/keystoreAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: KeystoreAPI;
  let keystoreModule: KeystoreModule;

  beforeEach(async () => {
    container = await createContainer(['core-keystore', 'core']);
    sandbox = sinon.createSandbox();
    keystoreModule = container.get(KeystoreTxSymbols.module);

    instance = container.getNamed(APISymbols.class, KeystoreTxSymbols.api);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('history', () => {
    it('should call getAllAcctValues from module', async () => {
      const getallAcctValuseStub = sandbox
        .stub(keystoreModule, 'getAllAcctValues')
        .resolves({
          history: 'banana',
        });
      const res = await instance.history({ address: '1R' as Address });
      expect(res).deep.eq({ history: 'banana' });
      expect(getallAcctValuseStub.called).true;
      expect(getallAcctValuseStub.calledWith('1R' as Address)).true;
    });
  });
});
