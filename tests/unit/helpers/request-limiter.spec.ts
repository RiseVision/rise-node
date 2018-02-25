import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import * as limiterModule from '../../../src/helpers/request-limiter';
import applyExpressLimits from '../../../src/helpers/request-limiter';
const requestLimiter = rewire('../../../src/helpers/request-limiter');

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/request-limiter', () => {
  let sandbox: SinonSandbox;
  const app: any = { enable: () => true, use: () => true };
  const config: any = {
    api: { options: { limits: undefined } },
    peers: { options: { limits: undefined } },
    trustProxy: true,
  };
  let appEnableSpy: any;
  let appUseSpy: any;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    appEnableSpy = sandbox.spy(app, 'enable');
    appUseSpy = sandbox.spy(app, 'use');
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
  });

  describe('applyLimits()', () => {
    it("limits === 'object'", () => {
      const limits: limiterModule.IRateLimiterOpts = {
        delayAfter: 100,
        delayMs: 200,
        max: 300,
        windowMs: 400,
      };

      const result = limiterModule.applyLimits(limits);
      expect(result).to.deep.equal(limits);
    });

    it("limits === 'object' and its properties have zero as value", () => {
      const limits: limiterModule.IRateLimiterOpts = {
        delayAfter: 0,
        delayMs: 0,
        max: 0,
        windowMs: 0,
      };

      const result = limiterModule.applyLimits(limits);
      expect(result).to.deep.equal(requestLimiter.__get__('defaults'));
    });

    it("limits === 'undefined'", () => {
      const result = limiterModule.applyLimits(undefined);
      expect(result).to.deep.equal(requestLimiter.__get__('defaults'));
    });
  });

  describe('applyLimitsToApp()', () => {
    it('Enabling trustProxy', () => {
      config.trustProxy = true;
      applyExpressLimits(app, config);
      expect(appEnableSpy.calledOnce).to.be.true;
      expect(appUseSpy.calledTwice).to.be.true;
      expect(appUseSpy.args[0][0]).to.equal('/api/');
      expect(appUseSpy.args[0][1]).to.be.a('function');
      expect(appUseSpy.args[1][0]).to.equal('/peer/');
      expect(appUseSpy.args[1][1]).to.be.a('function');
    });

    it('Without trustProxy', () => {
      config.trustProxy = false;
      applyExpressLimits(app, config);
      expect(appEnableSpy.called).to.be.false;
      expect(appUseSpy.calledTwice).to.be.true;
      expect(appUseSpy.args[0][0]).to.equal('/api/');
      expect(appUseSpy.args[0][1]).to.be.a('function');
      expect(appUseSpy.args[1][0]).to.equal('/peer/');
      expect(appUseSpy.args[1][1]).to.be.a('function');
    });
  });
});
