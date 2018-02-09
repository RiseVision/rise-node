import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { BlockProgressLogger } from '../../../src/helpers';

const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

describe('helpers/blocksProgressLogger', () => {
  let sandbox: SinonSandbox;
  let instance: BlockProgressLogger;
  let fakeILogger: any;
  let loggerStub: any;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    fakeILogger = { info: (message: string, data: string) => true };
    loggerStub = sandbox.stub(fakeILogger, 'info');
    instance = new BlockProgressLogger(10, 2, 'My message', fakeILogger);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
  });

  describe('Constructor', () => {
    it('Checking target and step', () => {
      expect(instance.target).to.equal(10);
      expect(instance.step).to.equal(5);
    });
  });

  describe('reset', () => {
    it('success', () => {
      instance.reset();
      expect(instance.applied).to.equal(0);
    });
  });

  describe('applyNext', () => {
    it('this.applied === 1', () => {
      instance.applyNext();
      expect(loggerStub.calledOnce).to.be.true;
      expect(loggerStub.args[0][0]).to.equal('My message');
      expect(loggerStub.args[0][1]).contain('applied');
    });

    it('this.applied === this.target', () => {
      instance.applied = 9;
      instance.applyNext();
      expect(loggerStub.calledOnce).to.be.true;
      expect(loggerStub.args[0][0]).to.equal('My message');
      expect(loggerStub.args[0][1]).contain('applied');
    });

    it('this.applied % this.step === 1', () => {
      instance.applied = 5;
      instance.applyNext();
      expect(loggerStub.calledOnce).to.be.true;
      expect(loggerStub.args[0][0]).to.equal('My message');
      expect(loggerStub.args[0][1]).contain('applied');
    });

    it('this.applied >= this.target', () => {
      instance.applied = 11;
      expect(() => instance.applyNext()).to.throw(
        'Cannot apply transaction over the limit'
      );
    });

    it('Rest of cases', () => {
      instance.applied = 1;
      instance.applyNext();
      expect(loggerStub.called).to.be.false;
    });
  });
});
