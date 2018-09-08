import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import { APIError, DeprecatedAPIError } from '../../../../src/apis/errors';
import { V2APIErrorHandler } from '../../../../src/apis/utils/v2ErrorHandler';
import { Symbols } from '../../../../src/ioc/symbols';
import { LoggerStub, ProtoBufHelperStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/utils/v2errorHandler', () => {
  let sandbox: SinonSandbox;
  let instance: V2APIErrorHandler;
  let request: any;
  let response: any;
  let responseStatusSpy: any;
  let next: any;
  let container: Container;
  let requestStub: any;
  let loggerStub: LoggerStub;
  let sendSpy: any;
  let pbStub: ProtoBufHelperStub;
  let contentTypeSpy: SinonSpy;

  beforeEach(() => {
    container = createContainer();
    container.bind(Symbols.api.utils.errorHandler).to(V2APIErrorHandler);
    sandbox = sinon.createSandbox();
    sendSpy = {send: sandbox.spy()};
    response = {status: () => sendSpy, send: sendSpy.send, contentType: () => response, end: sandbox.stub()};
    contentTypeSpy = sandbox.spy(response, 'contentType');
    responseStatusSpy = sandbox.spy(response, 'status');
    request = {url: {startsWith: sandbox.stub().callsFake((start) => start.match(/^\/v2/) ) }};
    requestStub = request.url.startsWith;
    next = sandbox.spy();
    pbStub = container.get(Symbols.helpers.protoBuf);
    loggerStub = container.get(Symbols.helpers.logger);
    instance = container.get(Symbols.api.utils.errorHandler);
    pbStub.enqueueResponse('encode', Buffer.from('aabbcc', 'hex'));
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('error()', () => {
    it('should call next if url does not start with /v2', () => {
      requestStub.callsFake((start) => start !== '/v2' );
      const err = new Error('Fake error');
      instance.error(err, request, response, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args).to.be.deep.equal([err]);
      expect(request.url.startsWith.calledOnce).to.be.true;
      expect(request.url.startsWith.firstCall.args).to.deep.equal(['/v2']);
    });

    it('should set status code or 200 if url starts with /v2/peer', () => {
      requestStub.callsFake((start) => {
        if (start === '/v2') {
          return true;
        }
        return start === '/v2/peer';
      });
      const err = new Error('Fake error');
      (err as any).statusCode = 200;
      instance.error(err, request, response, next);
      expect(next.notCalled).to.be.true;
      expect(request.url.startsWith.calledTwice).to.be.true;
      expect(request.url.startsWith.secondCall.args).to.deep.equal(['/v2/peer']);
      expect(response.status.calledOnce).to.be.true;
      expect(response.status.firstCall.args).to.be.deep.equal([200]);
    });

    it('should set status code or 500 if url does not start with /v2/peer', () => {
      requestStub.callsFake((start) => {
        if (start === '/v2') {
          return true;
        }
        return start !== '/v2/peer';
      });
      const err = new Error('Fake error');
      instance.error(err, request, response, next);
      expect(next.notCalled).to.be.true;
      expect(request.url.startsWith.calledTwice).to.be.true;
      expect(request.url.startsWith.secondCall.args).to.deep.equal(['/v2/peer']);
      expect(response.status.calledOnce).to.be.true;
      expect(response.status.firstCall.args).to.be.deep.equal([500]);
    });

    it('should use error.message if an Error is passed', () => {
      const err = new Error('Fake error');
      instance.error(err, request, response, next);
      expect(next.notCalled).to.be.true;
      expect(pbStub.stubs.encode.calledOnce).to.be.true;
      expect(pbStub.stubs.encode.firstCall.args[0].error).to.be.equal(err.message);
    });

    it('should use error.message if error.message is a string', () => {
      const err = {message: 'eeeeeerrr'};
      instance.error(err, request, response, next);
      expect(next.notCalled).to.be.true;
      expect(pbStub.stubs.encode.calledOnce).to.be.true;
      expect(pbStub.stubs.encode.firstCall.args[0].error).to.be.equal(err.message);
    });

    it('should call error.toString if no error.message', () => {
      const err = {toString: sandbox.stub().returns('toStringed')};
      instance.error(err, request, response, next);
      expect(next.notCalled).to.be.true;
      expect(err.toString.calledOnce).to.be.true;
      expect(pbStub.stubs.encode.calledOnce).to.be.true;
      expect(pbStub.stubs.encode.firstCall.args[0].error).to.be.equal('toStringed');
    });

    it('should set contentType as application/octet-stream', () => {
      const err = new Error('Fake error');
      instance.error(err, request, response, next);
      expect(response.contentType.calledOnce).to.be.true;
      expect(response.contentType.firstCall.args).to.be.deep.equal(['application/octet-stream']);
    });

    it('should call protoBuf encode', () => {
      const err = new Error('Fake error');
      instance.error(err, request, response, next);
      expect(pbStub.stubs.encode.calledOnce).to.be.true;
      expect(pbStub.stubs.encode.firstCall.args).to.be.deep.equal([{success: false, error: 'Fake error'}, 'APIError']);
    });

    it('should end the response with the result from protoBuf.encode', () => {
      const err = new Error('Fake error');
      instance.error(err, request, response, next);
      expect(response.end.calledOnce).to.be.true;
      expect(response.end.firstCall.args).to.be.deep.equal([Buffer.from('aabbcc', 'hex')]);
    });
  });
});
