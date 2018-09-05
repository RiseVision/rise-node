import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BaseRequest } from '../../src/requests';
import { IAPIRequest, Symbols } from '@risevision/core-interfaces';
import { ProtoBufHelperStub } from '../stubs/protobufhelperStub';
import { PeerType } from '@risevision/core-types';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { RequestFactoryType } from '../../src/utils';
import { p2pSymbols } from '../../src/helpers';

class TestRequest extends BaseRequest<any, any> implements IAPIRequest<any, any> {
  protected readonly method = 'POST';
  protected readonly baseUrl = '/test/';
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

  beforeEach(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
    container.bind(testSymbol).toFactory(factory(TestRequest));
    container.rebind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelperStub).inSingletonScope();
    protoBufStub = container.get(p2pSymbols.helpers.protoBuf);
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

    it('should add manipulated data if available in original options', () => {
      const origOptions = {data: {tx: {a: 1}}};
      const inst2 = new TestRequest();
      inst2.options = origOptions;
      const encodeStub = sandbox.stub(inst2 as any, 'encodeRequestData');
      encodeStub.returns({woof: 'meow'})
      const reqOptions = inst2.getRequestOptions();
      expect(reqOptions.data).to.not.be.undefined;
      expect(reqOptions.data).to.be.deep.equal({woof: 'meow'});
    });

    it('should return the expected object', () => {
      const origOptions = {data: {tx: {a: 1}}};
      const inst2 = new TestRequest();
      inst2.options = origOptions;
      const reqOptions = inst2.getRequestOptions();
      expect(reqOptions).to.be.deep.equal({
        data: null,
        method: 'POST',
        url: '/test/',
      });
    });

    it ('should append querystring if present', () => {
      const origOptions = {query: { cat: 'meows', dog: 'woofs'}};
      const inst2 = new TestRequest();
      inst2.options = origOptions as any;
      const reqOptions = inst2.getRequestOptions();
      expect(reqOptions).to.be.deep.equal({
        method: 'POST',
        url: '/test/?cat=meows&dog=woofs',
      });
    });
  });

  describe('getResponseData', () => {
    let decodeProtoBufResponseStub: SinonStub;
    let res;

    beforeEach(() => {
      decodeProtoBufResponseStub = sandbox.stub(instance as any, 'decodeProtoBufResponse');
      res =  {body: new Buffer('meow', 'utf8'), peer: {version: '1.1.1'}};
    });

    it('should call isProtoBuf', () => {
      instance.getResponseData(res);
    });

    it('should call decodeProtoBufResponse if isProtoBuf returns true', () => {
      const val = {success: true};
      decodeProtoBufResponseStub.returns(val);
      const ret = instance.getResponseData(res);
      expect(decodeProtoBufResponseStub.calledOnce).to.be.true;
      expect(decodeProtoBufResponseStub.firstCall.args.length).to.be.equal(1);
      expect(decodeProtoBufResponseStub.firstCall.args[0]).to.be.deep.equal(new Buffer('meow', 'utf8'));
      expect(ret).to.be.deep.equal(val);
    });
    // TODO: Check decodeProtoBufValidResponse called.
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
      it('should call pdecodeProtoBufValidResponse and return if it message is validated', () => {
        protoBufStub.stubs.decode.onFirstCall().returns({success: true});
        const decpbvrStub = sandbox.stub(instance as any, 'decodeProtoBufValidResponse').returns('decodedResult');
        const resp = (instance as any).decodeProtoBufResponse(Buffer.from('', 'hex'));
        expect(decpbvrStub.calledOnce).to.be.true;
        expect(decpbvrStub.firstCall.args[0]).to.be.deep.equal(Buffer.from('', 'hex'));
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
