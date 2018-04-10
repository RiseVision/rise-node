import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { SignaturesAPI } from '../../../src/apis/signatureAPI';
import { Symbols } from '../../../src/ioc/symbols';
import { SystemModuleStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/signatureAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: any;
  let systemModuleStub: SystemModuleStub;
  let result: any;

  beforeEach(() => {
    container = createContainer();
    sandbox = sinon.sandbox.create();
    container
      .bind(Symbols.api.signatures)
      .to(SignaturesAPI)
      .inSingletonScope();
    systemModuleStub = container.get(Symbols.modules.system);
    systemModuleStub.enqueueResponse('getFees', {
      fees: { secondsignature: 10 },
      fromHeight: 20,
      height: 30,
      toHeight: 40,
    });
    instance = container.get(Symbols.api.signatures);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('fees()', () => {
    it('success', async () => {
      result = await instance.fees({ height: 123 });
      expect(result).to.deep.equal({
        fee: 10,
        fromHeight: 20,
        height: 30,
        toHeight: 40,
      });
      expect(systemModuleStub.stubs.getFees.calledOnce).to.be.true;
      expect(systemModuleStub.stubs.getFees.args[0][0]).to.equal(123);
    });
  });

  describe('addSignature()', () => {
    it('Throws deprecated', async () => {
      await expect(instance.addSignature()).to.be.rejectedWith(
        'Method is deprecated'
      );
    });
  });
});
