import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { ISystemModule, Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { SignaturesAPI } from '../src/signatureAPI';
import { SigSymbols } from '../src/symbols';
import { APISymbols } from '@risevision/core-apis';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/signatureAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: SignaturesAPI;
  let systemModule: ISystemModule;
  let result: any;

  beforeEach(async () => {
    container = await createContainer(['core-secondsignature', 'core', 'core-helpers']);
    sandbox = sinon.createSandbox();
    systemModule = container.get(Symbols.modules.system);

    instance = container.getNamed(APISymbols.api, SigSymbols.api);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('fees()', () => {
    it('should return an object with the properties: fee, fromHeight, height and toHeight', async () => {
      const stub = sandbox.stub(systemModule, 'getFees').returns({
        fees: { secondsignature: 10 },
        fromHeight: 20,
        height: 30,
        toHeight: 40,
      });
      result = await instance.fees({ height: 123 });
      expect(result).to.deep.equal({
        fee: 10,
        fromHeight: 20,
        height: 30,
        toHeight: 40,
      });
      expect(stub.calledOnce).to.be.true;
      expect(stub.args[0][0]).to.equal(123);
    });
  });

  describe('addSignature()', () => {
    it('should throw deprecated', async () => {
      await expect(instance.addSignature()).to.be.rejectedWith(
        'Method is deprecated'
      );
    });
  });
});
