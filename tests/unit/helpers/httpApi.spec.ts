import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { middleware } from '../../../src/helpers';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/httpApi', () => {
  let sandbox: SinonSandbox;
  let loggerFake: any;
  let loggerSpy: any;
  let req: any;
  let res: any;
  let setHeaderSpy: any;
  let statusSpy: any;
  let sendSpy: any;
  let next: any;
  let config: any;
  let sendObject: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    loggerFake = { log: () => true };
    loggerSpy = sandbox.spy(loggerFake, 'log');
    req = { method: 'aaa', url: 'bbb', ip: '80.3.10.20' };
    sendObject = { send: () => () => true };
    sendSpy = sandbox.spy(sendObject, 'send');
    res = { setHeader: () => true, status: () => sendObject };
    setHeaderSpy = sandbox.spy(res, 'setHeader');
    statusSpy = sandbox.spy(res, 'status');
    next = sandbox.stub().returns(123);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('logClientConnections()', () => {
    it('should call to logger.log() and next() once', () => {
      const result = middleware.logClientConnections(loggerFake);
      const nextResult = result(req, res, next);
      expect(loggerSpy.calledOnce).to.be.true;
      expect(loggerSpy.args[0][0]).to.equal('aaa bbb from 80.3.10.20');
      expect(next.calledOnce).to.be.true;
      expect(next()).to.equal(nextResult);
    });
  });

  describe('attachResponseHeader()', () => {
    it('should call to setHeader() and next() once', () => {
      const result = middleware.attachResponseHeader('aaa', 'bbb');
      const nextResult = result(req, res, next);
      expect(setHeaderSpy.calledOnce).to.be.true;
      expect(setHeaderSpy.args[0][0]).to.equal('aaa');
      expect(setHeaderSpy.args[0][1]).to.equal('bbb');
      expect(next.calledOnce).to.be.true;
      expect(next()).to.equal(nextResult);
    });
  });

  describe('applyAPIAccessRules()', () => {
    it('Internal API: Forwarding to next()', () => {
      config = {
        peers: {
          access: { blackList: [] },
          enabled: true,
        },
      };
      const result = middleware.applyAPIAccessRules(config);
      req.url = '/peer';
      result(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(statusSpy.called).to.be.false;
      expect(sendSpy.called).to.be.false;
    });

    it('Internal API: Returning a 403 response', () => {
      config = {
        peers: {
          access: { blackList: ['80.3.10.20'] },
          enabled: true,
        },
      };
      const result = middleware.applyAPIAccessRules(config);
      req.url = '/peer';
      result(req, res, next);
      expect(next.called).to.be.false;
      expect(statusSpy.calledOnce).to.be.true;
      expect(statusSpy.args[0][0]).to.equal(403);
      expect(sendSpy.calledOnce).to.be.true;
      expect(sendSpy.args[0][0]).deep.equal({
        error: 'API access denied',
        success: false,
      });
    });

    it('Internal API: Returning a 500 response', () => {
      config = {
        peers: {
          access: { blackList: [] },
          enabled: false,
        },
      };
      const result = middleware.applyAPIAccessRules(config);
      req.url = '/peer';
      result(req, res, next);
      expect(next.called).to.be.false;
      expect(statusSpy.calledOnce).to.be.true;
      expect(statusSpy.args[0][0]).to.equal(500);
      expect(sendSpy.calledOnce).to.be.true;
      expect(sendSpy.args[0][0]).deep.equal({
        error: 'API access disabled',
        success: false,
      });
    });

    it('Public API: Forwarding to next() if public access is TRUE', () => {
      config = {
        api: {
          access: { public: true, whiteList: [] },
          enabled: true,
        },
      };
      const result = middleware.applyAPIAccessRules(config);
      result(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(statusSpy.called).to.be.false;
      expect(sendSpy.called).to.be.false;
    });

    it('Public API: Forwarding to next() if IP is in whiteList', () => {
      config = {
        api: {
          access: { public: false, whiteList: ['80.3.10.20'] },
          enabled: true,
        },
      };
      const result = middleware.applyAPIAccessRules(config);
      result(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(statusSpy.called).to.be.false;
      expect(sendSpy.called).to.be.false;
    });

    it('Public API: Returning a 403 response if public is false', () => {
      config = {
        api: {
          access: { public: false, whiteList: [] },
          enabled: true,
        },
      };
      const result = middleware.applyAPIAccessRules(config);
      result(req, res, next);
      expect(next.called).to.be.false;
      expect(statusSpy.calledOnce).to.be.true;
      expect(statusSpy.args[0][0]).to.equal(403);
      expect(sendSpy.calledOnce).to.be.true;
      expect(sendSpy.args[0][0]).deep.equal({
        error: 'API access denied',
        success: false,
      });
    });

    it('Public API: Returning a 403 response if IP is not in whiteList', () => {
      config = {
        api: {
          access: { public: false, whiteList: [] },
          enabled: true,
        },
      };
      const result = middleware.applyAPIAccessRules(config);
      result(req, res, next);
      expect(next.called).to.be.false;
      expect(statusSpy.calledOnce).to.be.true;
      expect(statusSpy.args[0][0]).to.equal(403);
      expect(sendSpy.calledOnce).to.be.true;
      expect(sendSpy.args[0][0]).deep.equal({
        error: 'API access denied',
        success: false,
      });
    });

    it('Public API: Returning a 500 response', () => {
      config = {
        api: {
          access: { public: true, whiteList: [] },
          enabled: false,
        },
      };
      const result = middleware.applyAPIAccessRules(config);
      result(req, res, next);
      expect(next.called).to.be.false;
      expect(statusSpy.calledOnce).to.be.true;
      expect(statusSpy.args[0][0]).to.equal(500);
      expect(sendSpy.calledOnce).to.be.true;
      expect(sendSpy.args[0][0]).deep.equal({
        error: 'API access disabled',
        success: false,
      });
    });
  });

  describe('protoBuf()', () => {
    beforeEach(() => {
      req.is = sandbox.stub();
      req.on = sandbox.stub();
    });

    it('should check if request is application/octet-stream', () => {
      const pb = middleware.protoBuf();
      pb(req, res, next);
      expect(req.is.calledOnce).to.be.true;
      expect(req.is.firstCall.args).to.be.deep.equal(['application/octet-stream']);
    });

    it('should call next if request is not octet-stream', () => {
      req.is.returns(false);
      const pb = middleware.protoBuf();
      pb(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(req.protoBuf).to.be.undefined;
    });

    it('should call req.on() twice if request is octet-stream', () => {
      req.is.returns(true);
      const pb = middleware.protoBuf();
      pb(req, res, next);
      expect(req.on.calledTwice).to.be.true;
      expect(req.on.firstCall.args[0]).to.be.equal('data');
      expect(req.on.firstCall.args[1]).to.be.a('function');
      expect(req.on.secondCall.args[0]).to.be.equal('end');
      expect(req.on.secondCall.args[1]).to.be.a('function');
    });

    it('should not add protoBuf property to req on request end if no data was sent', () => {
      req.is.returns(true);
      const pb = middleware.protoBuf();
      pb(req, res, next);
      const onEndCback = req.on.secondCall.args[1];
      onEndCback();
      expect(req.protoBuf).to.be.undefined;
      expect(next.calledOnce).to.be.true;
    });

    it('should add protoBuf property to req on request end', () => {
      req.is.returns(true);
      const pb = middleware.protoBuf();
      pb(req, res, next);
      const onDataCback = req.on.firstCall.args[1];
      const onEndCback = req.on.secondCall.args[1];
      onDataCback(Buffer.from('aaaa', 'hex'));
      onDataCback(Buffer.from('0000', 'hex'));
      onDataCback(Buffer.from('5555', 'hex'));
      onEndCback();
      expect(req.protoBuf).to.be.deep.equal(Buffer.from('aaaa00005555', 'hex'));
    });
  });
});
