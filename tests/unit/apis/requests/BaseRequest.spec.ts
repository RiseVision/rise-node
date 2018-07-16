import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BaseRequest, IAPIRequest } from '../../../../src/apis/requests/BaseRequest';
import { Symbols } from '../../../../src/ioc/symbols';
import { PeerType } from '../../../../src/logic';
import { ProtoBufHelperStub } from '../../../stubs/helpers/ProtoBufHelperStub';
import { createContainer } from '../../../utils/containerCreator';

class TestRequest extends BaseRequest<any, any> implements IAPIRequest<any, any> {
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

    it('should call getMethod', () => {
      instance.getRequestOptions(true);
      expect(getMethodStub.calledOnce).to.be.true;
    });

    it('should call getBaseUrl', () => {
      instance.getRequestOptions(true);
      expect(getBaseUrlStub.calledOnce).to.be.true;
    });

    it('should add data if available in original options', () => {
      const origOptions = {data: {tx: {a: 1}}};
      const inst2 = new TestRequest();
      inst2.options = origOptions;
      const reqOptions = inst2.getRequestOptions(true);
      expect(reqOptions.data).to.not.be.undefined;
      expect(reqOptions.data).to.be.deep.equal(origOptions.data);
    });

    it('should return the expected object', () => {
      const origOptions = {data: {tx: {a: 1}}};
      const inst2 = new TestRequest();
      inst2.options = origOptions;
      const reqOptions = inst2.getRequestOptions(true);
      expect(reqOptions).to.be.deep.equal({
        data: origOptions.data,
        isProtoBuf: true,
        method: 'POST',
        url: '/test/',
      });
    });
  });

  describe('getResponseData', () => {
    let decodeProtoBufResponseStub: SinonStub;
    let res;

    beforeEach(() => {
      decodeProtoBufResponseStub = sandbox.stub(instance as any, 'decodeProtoBufResponse');
      res =  {body: {success: 1}};
    });

    it('should call isProtoBuf', () => {
      instance.getResponseData(res);
    });

    it('should call decodeProtoBufResponse if isProtoBuf returns true', () => {
      const val = {success: true};
      decodeProtoBufResponseStub.returns(val);
      const ret = instance.getResponseData(res);
      expect(decodeProtoBufResponseStub.calledOnce).to.be.true;
      expect(decodeProtoBufResponseStub.firstCall.args.length).to.be.equal(2);
      expect(decodeProtoBufResponseStub.firstCall.args[0]).to.be.deep.equal(res);
      expect(decodeProtoBufResponseStub.firstCall.args[1]).to.be.equal('APISuccess');
      expect(ret).to.be.deep.equal(val);
    });

    it('should not call decodeProtoBufResponse if isProtoBuf returns false', () => {
      (instance as any).supportsProtoBuf = false;
      instance.getResponseData(res);
      expect(decodeProtoBufResponseStub.notCalled).to.be.true;
    });

    it('should return response body if not protoBuf', () => {
      (instance as any).supportsProtoBuf = false;
      const ret = instance.getResponseData(res);
      expect(ret).to.be.deep.equal(res.body);
    });
  });
  describe('getOrigOptions', () => {
    it('should return the original options', () => {
      const opt = {data: 'data'};
      const instance2 = new TestRequest();
      instance2.options = opt;
      expect(instance2.getOrigOptions()).to.be.deep.equal(opt);
    });
  });

  describe('getQueryString', () => {
    it('should return empty string if options.query is undefined', () => {
      const opt = {data: 'data'};
      const instance2 = new TestRequest();
      instance2.options = opt;
      expect((instance2 as any).getQueryString()).to.be.equal('');
    });

    it('should return query string with question mark if options.query is passed', () => {
      const opt = {data: 'data', query: {a: 'a', b: 'b'}};
      const instance2 = new TestRequest();
      instance2.options = opt;
      expect((instance2 as any).getQueryString()).to.be.equal('?a=a&b=b');
    });
  });

  describe('decodeProtoBufResponse', () => {

    describe('when response status is 200', () => {
      const res = {status: 200, body: Buffer.from('', 'hex')};
      it('should call protoBufHelper.decode and return if it message is validated', () => {
        protoBufStub.enqueueResponse('decode', 'decodedResult');
        const resp = (instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');
        expect(protoBufStub.stubs.decode.calledOnce).to.be.true;
        expect(protoBufStub.stubs.decode.firstCall.args).to.be.deep.equal([res.body, 'namespace', 'messageType']);
        expect(resp).to.be.equal('decodedResult');
      });
    });

    describe('when response status is NOT 200', () => {
      const res = {status: 500, body: Buffer.from('', 'hex')};
      it('should call protoBufHelper.decode and return if it message is validated', () => {
        protoBufStub.enqueueResponse('decode', 'decodedErr');
        const resp = (instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');
        expect(protoBufStub.stubs.decode.calledOnce).to.be.true;
        expect(protoBufStub.stubs.decode.firstCall.args).to.be.deep.equal([res.body, 'APIError']);
        expect(resp).to.be.equal('decodedErr');
      });

      it('should throw if validation fails', () => {
        protoBufStub.stubs.decode.throws(new Error('err'));
        expect(() => {(instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType'); })
          .to.throw('Cannot decode error response');
      });
    });
  });

});
