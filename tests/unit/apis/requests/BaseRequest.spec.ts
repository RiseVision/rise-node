import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BaseRequest, IAPIRequest } from '../../../../src/apis/requests/BaseRequest';
import { Symbols } from '../../../../src/ioc/symbols';
import { PeerType } from '../../../../src/logic';
import { ProtoBufHelperStub } from '../../../stubs/helpers/ProtoBufHelperStub';
import { createContainer } from '../../../utils/containerCreator';

class TestRequest extends BaseRequest implements IAPIRequest {
  protected readonly method = 'POST';
  protected readonly baseUrl = '/test/';
  protected readonly supportsProtoBuf = true;
}

// tslint:disable no-unused-expression max-line-length
describe('apis/requests/BaseRequest', () => {
  let sandbox: SinonSandbox;
  let instance: TestRequest;
  let container: Container;
  let protoBufStub: ProtoBufHelperStub;
  let peer: PeerType;

  beforeEach(() => {
    sandbox   = sinon.createSandbox();
    container = createContainer();
    protoBufStub = container.get(Symbols.helpers.protoBuf);
    peer = {
      ip: '127.0.0.1',
      port: 5555,
      state: 2,
      os: 'unix',
      version: '1.1.1',
      broadhash: '123123123',
      height: 123,
      clock: 9999999,
      updated: 123,
      nonce: '1231234'
    };
    instance = new TestRequest();
    instance.setPeer(peer as any);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getRequestOptions', () => {
    let isProtoBufStub: SinonStub;
    let getMethodStub: SinonStub;
    let getBaseUrlStub: SinonStub;

    beforeEach(() => {
      isProtoBufStub = sandbox.stub(instance as any, 'isProtoBuf').returns(false);
      getMethodStub = sandbox.stub(instance as any, 'getMethod').returns('GET');
      getBaseUrlStub = sandbox.stub(instance as any, 'getBaseUrl').returns('/testurl');
    });

    it('should call isProtoBuf', () => {
      instance.getRequestOptions();
      expect(isProtoBufStub.calledOnce).to.be.true;
    });

    it('should call getMethod', () => {
      instance.getRequestOptions();
      expect(getMethodStub.calledOnce).to.be.true;
    });

    it('should call getBaseUrl', () => {
      instance.getRequestOptions();
      expect(getBaseUrlStub.calledOnce).to.be.true;
    });

    it('should add data if available in original options', () => {
      const origOptions = {data: {tx: {a: 1}}};
      const inst2 = new TestRequest(origOptions);
      inst2.setPeer(peer as any);
      const reqOptions = inst2.getRequestOptions();
      expect(reqOptions.data).to.not.be.undefined;
      expect(reqOptions.data).to.be.deep.equal(origOptions.data);
    });

    it('should return the expected object', () => {
      const origOptions = {data: {tx: {a: 1}}};
      const inst2 = new TestRequest(origOptions);
      inst2.setPeer(peer as any);
      const reqOptions = inst2.getRequestOptions();
      expect(reqOptions).to.be.deep.equal({
        data: origOptions.data,
        isProtoBuf: true,
        method: 'POST',
        url: '/test/',
      });
    });
  });

  describe('getResponseData', () => {
    let isProtoBufStub: SinonStub;
    let decodeProtoBufResponseStub: SinonStub;
    let res;

    beforeEach(() => {
      isProtoBufStub = sandbox.stub(instance as any, 'isProtoBuf');
      decodeProtoBufResponseStub = sandbox.stub(instance as any, 'decodeProtoBufResponse');
      res =  {body: {success: 1}};
    });

    it('should call isProtoBuf', () => {
      instance.getResponseData(res);
      expect(isProtoBufStub.calledOnce).to.be.true;
    });

    it('should call decodeProtoBufResponse if isProtoBuf returns true', () => {
      const val = {success: true};
      isProtoBufStub.returns(true);
      decodeProtoBufResponseStub.returns(val);
      const ret = instance.getResponseData(res);
      expect(decodeProtoBufResponseStub.calledOnce).to.be.true;
      expect(decodeProtoBufResponseStub.firstCall.args.length).to.be.equal(2);
      expect(decodeProtoBufResponseStub.firstCall.args[0]).to.be.deep.equal(res);
      expect(decodeProtoBufResponseStub.firstCall.args[1]).to.be.equal('APISuccess');
      expect(ret).to.be.deep.equal(val);
    });

    it('should not call decodeProtoBufResponse if isProtoBuf returns false', () => {
      isProtoBufStub.returns(false);
      instance.getResponseData(res);
      expect(decodeProtoBufResponseStub.notCalled).to.be.true;
    });

    it('should return response body if not protoBuf', () => {
      isProtoBufStub.returns(false);
      const ret = instance.getResponseData(res);
      expect(ret).to.be.deep.equal(res.body);
    });
  });

  describe('isProtoBuf', () => {
    it('should return false if supportsProtoBuf is false', () => {
      (instance as any).supportsProtoBuf = false;
      expect(instance.isProtoBuf()).to.be.false;
    });

    it('should return false if peer version is less than minimum', () => {
      peer.version = '0.9.0';
      expect(instance.isProtoBuf()).to.be.false;
    });

    it('should return true if supportsProtobuf and peer version is OK', () => {
      peer.version = '2.0.0';
      (instance as any).supportsProtoBuf = true;
      expect(instance.isProtoBuf()).to.be.true;
    });
  });

  describe('setPeer', () => {
    it('should set the passed peer to instance.peer', () => {
      const p = {test: 'test'};
      instance.setPeer(p as any);
      expect((instance as any).peer).to.be.deep.equal(p);
    });
  });

  describe('getOrigOptions', () => {
    it('should return the original options', () => {
      const opt = {data: 'data'};
      const instance2 = new TestRequest(opt);
      expect(instance2.getOrigOptions()).to.be.deep.equal(opt);
    });
  });

  describe('getQueryString', () => {
    it('should return empty string if options.query is undefined', () => {
      const opt = {data: 'data'};
      const instance2 = new TestRequest(opt);
      expect((instance2 as any).getQueryString()).to.be.equal('');
    });

    it('should return query string with question mark if options.query is passed', () => {
      const opt = {data: 'data', query: {a: 'a', b: 'b'}};
      const instance2 = new TestRequest(opt);
      expect((instance2 as any).getQueryString()).to.be.equal('?a=a&b=b');
    });
  });

  describe('decodeProtoBufResponse', () => {

    describe('when response status is 200', () => {
      const res = {status: 200, body: Buffer.from('', 'hex')};
      it('should call protoBufHelper.validate with the specific namespace and message type', () => {
        protoBufStub.enqueueResponse('validate', true);
        protoBufStub.enqueueResponse('decode', 'decodedResult');
        const resp = (instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');
        expect(protoBufStub.stubs.validate.calledOnce).to.be.true;
        expect(protoBufStub.stubs.validate.firstCall.args).to.be.deep.equal([res.body, 'namespace', 'messageType']);
      });

      it('should call protoBufHelper.decode and return if it message is validated', () => {
        protoBufStub.enqueueResponse('validate', true);
        protoBufStub.enqueueResponse('decode', 'decodedResult');
        const resp = (instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');
        expect(protoBufStub.stubs.decode.calledOnce).to.be.true;
        expect(protoBufStub.stubs.decode.firstCall.args).to.be.deep.equal([res.body, 'namespace', 'messageType']);
        expect(resp).to.be.equal('decodedResult');
      });

      it('should throw if validation fails', () => {
        protoBufStub.enqueueResponse('validate', false);
        protoBufStub.enqueueResponse('decode', 'decodedResult');
        expect(() => {(instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');})
          .to.throw('Cannot decode response');
      });
    });

    describe('when response status is NOT 200', () => {
      const res = {status: 500, body: Buffer.from('', 'hex')};
      it('should call protoBufHelper.validate with APIError namespace', () => {
        protoBufStub.enqueueResponse('validate', true);
        protoBufStub.enqueueResponse('decode', 'decodedResult');
        const resp = (instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');
        expect(protoBufStub.stubs.validate.calledOnce).to.be.true;
        expect(protoBufStub.stubs.validate.firstCall.args).to.be.deep.equal([res.body, 'APIError']);
      });

      it('should call protoBufHelper.decode and return if it message is validated', () => {
        protoBufStub.enqueueResponse('validate', true);
        protoBufStub.enqueueResponse('decode', 'decodedErr');
        const resp = (instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');
        expect(protoBufStub.stubs.decode.calledOnce).to.be.true;
        expect(protoBufStub.stubs.decode.firstCall.args).to.be.deep.equal([res.body, 'APIError']);
        expect(resp).to.be.equal('decodedErr');
      });

      it('should throw if validation fails', () => {
        protoBufStub.enqueueResponse('validate', false);
        protoBufStub.enqueueResponse('decode', 'decodedResult');
        expect(() => {(instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType'); })
          .to.throw('Cannot decode error response');
      });
    });
  });

});
