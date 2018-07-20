import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { APIError, DeprecatedAPIError } from '../../../../src/apis/errors';
import { APIErrorHandler } from '../../../../src/apis/utils/errorHandler';
import { Symbols } from '../../../../src/ioc/symbols';
import { LoggerStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/utils/errorHandler', () => {
  let sandbox: SinonSandbox;
  let instance: APIErrorHandler;
  let request: any;
  let response: any;
  let responseStatusSpy: any;
  let next: any;
  let container: Container;
  let requestStub: any;
  let loggerStub: LoggerStub;
  let sendSpy: any;

  beforeEach(() => {
    container = createContainer();
    container.bind(Symbols.api.utils.errorHandler).to(APIErrorHandler);
    sandbox = sinon.createSandbox();
    sendSpy = {send: sandbox.spy()};
    response = {status: () => sendSpy, send: sendSpy.send };
    responseStatusSpy = sandbox.spy(response, 'status');
    request = {url: {startsWith: sandbox.stub().callsFake((start) => !(start === '/v2') ) }};
    requestStub = request.url.startsWith;
    next = sandbox.spy();
    loggerStub = container.get(Symbols.helpers.logger);
    instance = container.get(Symbols.api.utils.errorHandler);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('error()', () => {
    it('If url starts with /peer', () => {
      requestStub.callsFake((start) => !(start === '/v2') );
      instance.error(new Error('Fake error'), request, response, next);
      expect(loggerStub.stubs.error.called).to.be.false;
      expect(loggerStub.stubs.warn.calledOnce).to.be.true;
      expect(loggerStub.stubs.warn.args[0][0]).to.contains('Transport error');
      expect(loggerStub.stubs.warn.args[0][1]).to.equal('Fake error');
      expect(responseStatusSpy.calledOnce).to.be.true;
      expect(responseStatusSpy.args[0][0]).to.equal(200);
      expect(sendSpy.send.calledOnce).to.be.true;
      expect(sendSpy.send.args[0][0]).to.deep.equal({success: false, error: 'Fake error'});
      // expect(next.calledOnce).to.be.true;
      // expect(next.args[0][0]).to.deep.equal({success: false, error: 'Fake error'});
    });

    it('If url NOT starts with /peer', () => {
      requestStub.returns(false);
      instance.error('Another fake error', request, response, next);
      expect(loggerStub.stubs.warn.called).to.be.false;
      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.args[0][0]).to.contains('API error');
      expect(loggerStub.stubs.error.args[0][1]).to.equal('Another fake error');
      expect(responseStatusSpy.calledOnce).to.be.true;
      expect(responseStatusSpy.args[0][0]).to.equal(200);
      expect(sendSpy.send.calledOnce).to.be.true;
      expect(sendSpy.send.args[0][0]).to.deep.equal({success: false, error: 'Another fake error'});
      // expect(next.calledOnce).to.be.true;
      // expect(next.args[0][0]).to.deep.equal({success: false, error: 'Another fake error'});
    });
  });

  describe('APIError', () => {
    it('should honorate statusCode of APIError', () => {
      instance.error(new APIError('Another fake error', 500), request, response, next);
      expect(responseStatusSpy.args[0][0]).to.equal(500);
      expect(sendSpy.send.args[0][0]).to.deep.equal({success: false, error: 'Another fake error'});
    });
    it('should honorate Deprecated API Error (which is child of APIError)', () => {
      instance.error(new DeprecatedAPIError(), request, response, next);
      expect(responseStatusSpy.args[0][0]).to.equal(500);
      expect(sendSpy.send.args[0][0]).to.deep.equal({success: false, error: 'Method is deprecated'});
    });
  });
});
