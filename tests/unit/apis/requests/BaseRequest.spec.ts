import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BaseRequest, IAPIRequest } from '../../../../src/apis/requests/BaseRequest';
import { RequestFactoryType } from '../../../../src/apis/requests/requestFactoryType';
import { Symbols } from '../../../../src/ioc/symbols';
import { PeerType } from '../../../../src/logic';
import { ProtoBufHelperStub } from '../../../stubs/helpers/ProtoBufHelperStub';
import { createContainer } from '../../../utils/containerCreator';

class TestRequest extends BaseRequest<any, any> implements IAPIRequest<any, any> {
  protected readonly method = 'POST';
  protected readonly baseUrl = '/test/';
  protected readonly supportsProtoBuf = true;
}

const factory = (what: (new () => any)) => (ctx) => (options) => {
  const toRet = ctx.container.resolve(what);
  toRet.options = options;
  return toRet;
};

// tslint:disable no-unused-expression max-line-length
describe('apis/requests/BaseRequest', () => {
  let sandbox: SinonSandbox;
  let instance: TestRequest;
  let container: Container;
  let protoBufStub: ProtoBufHelperStub;
  let peer: PeerType;
  const testSymbol = Symbol('testRequest');

  beforeEach(() => {
    sandbox   = sinon.createSandbox();
    container = createContainer();
    container.bind(testSymbol).toFactory(factory(TestRequest));
    protoBufStub = container.get(Symbols.helpers.protoBuf);
    peer = {
      broadhash: '123123123',
      clock: 9999999,
      height: 123,
      ip: '127.0.0.1',
      nonce: '1231234',
      os: 'unix',
      port: 5555,
      state: 2,
      updated: 123,
      version: '1.1.1',
    };
    const instanceFactory = container.get<RequestFactoryType<any, TestRequest>>(testSymbol);
    instance = instanceFactory({data: null});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getRequestOptions', () => {
    let getMethodStub: SinonStub;
    let getBaseUrlStub: SinonStub;

    beforeEach(() => {
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
      res =  {body: {success: 1}, peer: {version: '1.1.1'}};
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
      it('should call protoBufHelper.decodeToObj and return if it message is validated', () => {
        protoBufStub.enqueueResponse('decodeToObj', 'decodedResult');
        const resp = (instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');
        expect(protoBufStub.stubs.decodeToObj.calledOnce).to.be.true;
        expect(protoBufStub.stubs.decodeToObj.firstCall.args[0]).to.be.deep.equal(res.body);
        expect(protoBufStub.stubs.decodeToObj.firstCall.args[1]).to.be.deep.equal('namespace');
        expect(protoBufStub.stubs.decodeToObj.firstCall.args[2]).to.be.deep.equal('messageType');
        expect(resp).to.be.equal('decodedResult');
      });
    });

    describe('when response is an error', () => {
      const res = {status: 200, body: Buffer.from('', 'hex')};
      it('should try first to parse the request as an API error', () => {
        const err = {success: false, error: 'thisIsAnErr'};
        protoBufStub.stubs.decode.returns(err);
        protoBufStub.stubs.decodeToObj.throws(new Error('decodeToObjError'));
        let resp;
        expect(() => {
          resp = (instance as any).decodeProtoBufResponse(res, 'namespace', 'messageType');
        }).to.throw('thisIsAnErr');
      });
    });
  });

});
