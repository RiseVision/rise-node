import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as ip from 'ip';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { SinonSpy } from 'sinon';
import { HeightRequest } from '../../../src/apis/requests/HeightRequest';
import { PeerState, PeerType } from '../../../src/logic';
import { APIRequestStub, TransportModuleStub } from '../../stubs';

const expect          = chai.expect;
const ProxyPeerLogic = proxyquire('../../../src/logic/peer.ts', {ip});
let hr: any;

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('logic/peer', () => {
  let instance;
  let transportModuleStub: TransportModuleStub;
  beforeEach(() => {
    transportModuleStub               = new TransportModuleStub();
    instance                          = new ProxyPeerLogic.PeerLogic();
    (instance as any).transportModule = transportModuleStub;
    hr = new HeightRequest();
    (hr as any).transportModule = {getFromPeer: (a) => Promise.resolve(a)};
    (instance as any).hrFactory = () => hr;
  });

  describe('properties', () => {
    it('should have the correct value', () => {
      expect(instance.properties).to.deep.equal([
        'ip',
        'port',
        'state',
        'os',
        'version',
        'broadhash',
        'height',
        'clock',
        'updated',
        'nonce',
      ]);
    });
  });

  describe('immutable', () => {
    it('should have the correct value', () => {
      expect(instance.immutable).to.deep.equal(['ip', 'port', 'string']);
    });
  });

  describe('headers', () => {
    it('should have the correct value', () => {
      expect(instance.headers).to.deep.equal([
        'os',
        'version',
        'broadhash',
        'height',
        'nonce',
      ]);

    });
  });

  describe('nullable', () => {
    it('should have the correct value', () => {
      expect(instance.nullable).to.deep.equal([
        'os',
        'version',
        'broadhash',
        'height',
        'clock',
        'updated',
      ]);

    });
  });

  describe('PeerState', () => {
    it('BANNED should be equal to 0 ', () => {
      expect(PeerState.BANNED).to.be.eq(0);
    });

    it('DISCONNECTED should be equal to 1 ', () => {
      expect(PeerState.DISCONNECTED).to.be.eq(1);
    });

    it('CONNECTED should be equal to 2 ', () => {
      expect(PeerState.CONNECTED).to.be.eq(2);
    });
  });

  describe('accept', () => {
    let peer: PeerType;

    beforeEach(() => {
      peer = {
        broadhash: '',
        clock    : 1,
        height   : 9999,
        ip       : '1.2.3.4',
        nonce    : 'nonce',
        os       : 'ubuntu',
        port     : 5555,
        state    : PeerState.CONNECTED,
        updated  : 0,
        version  : '1.0',
      };
    });

    it('should set instance.string to ip:port string', () => {
      peer.ip   = '127.0.0.1';
      peer.port = 1010;
      instance.accept(peer);
      expect(instance.string).to.deep.equal('127.0.0.1:1010');
    });

    it('should call ip.fromLong and set instance.string to ip:port from a long ip', () => {
      const fromLongSpy = sinon.spy(ip, 'fromLong');
      peer.ip           = '2130706433';
      peer.port         = 1010;
      instance.accept(peer);
      expect(fromLongSpy.called).to.be.true;
      expect(instance.string).to.deep.equal('127.0.0.1:1010');
      fromLongSpy.restore();
    });

    it('should call normalize', () => {
      const normalizeSpy = sinon.spy(instance, 'normalize');
      instance.accept(peer);
      expect(normalizeSpy.called).to.be.true;
    });

    it('should return the instance', () => {
      const retVal = instance.accept(peer);
      expect(retVal).to.be.deep.equal(instance);
    });
  });

  describe('normalize', () => {
    let peer;
    let parseIntSpy: SinonSpy;

    beforeEach(() => {
      peer = {
        broadhash: '',
        clock    : '',
        height   : '',
        ip       : '127.0.0.1',
        nonce    : '',
        os       : '',
        port     : '1010',
        state    : '2',
        updated  : '',
        version  : '',
      };
      instance.accept(peer);
      parseIntSpy = sinon.spy(instance, 'parseInt');
    });

    afterEach(() => {
      parseIntSpy.restore();
    });

    it('should call parseInt correctly when no height and dappid are passed', () => {
      const expectedPeer = {
        broadhash: '',
        clock    : '',
        height   : '',
        ip       : '127.0.0.1',
        nonce    : '',
        os       : '',
        port     : 1010,
        state    : 2,
        updated  : '',
        version  : '',
      };

      const normalized = instance.normalize(Object.assign({}, peer));

      expect(parseIntSpy.calledTwice).to.be.true;
      expect(parseIntSpy.firstCall.args.length).to.equal(2);
      expect(parseIntSpy.firstCall.args[0]).to.equal(instance.port);
      expect(parseIntSpy.firstCall.args[1]).to.equal(0);
      expect(parseIntSpy.getCall(1).args.length).to.equal(2);
      expect(parseIntSpy.getCall(1).args[0]).to.equal(instance.state);
      expect(parseIntSpy.getCall(1).args[1]).to.equal(PeerState.DISCONNECTED);
      expect(normalized).to.deep.equal(expectedPeer);
    });

    it('should call parseInt correctly when no height is passed', () => {
      const expectedPeer = {
        broadhash: '',
        clock    : '',
        height   : '',
        ip       : '127.0.0.1',
        nonce    : '',
        os       : '',
        port     : 1010,
        state    : 2,
        updated  : '',
        version  : '',
      };

      const normalized = instance.normalize(Object.assign({}, peer));

      expect(parseIntSpy.calledTwice).to.be.true;
      expect(parseIntSpy.firstCall.args.length).to.equal(2);
      expect(parseIntSpy.firstCall.args[0]).to.equal(peer.port);
      expect(parseIntSpy.firstCall.args[1]).to.equal(0);
      expect(parseIntSpy.getCall(1).args.length).to.equal(2);
      expect(parseIntSpy.getCall(1).args[0]).to.equal(peer.state);
      expect(parseIntSpy.getCall(1).args[1]).to.equal(PeerState.DISCONNECTED);
      expect(normalized).to.deep.equal(expectedPeer);
    });

    it('should return unmuted dappIds array in peer obj without height', () => {
      const expectedPeer = {
        broadhash: '',
        clock    : '',
        dappid   : ['dappId', 'dappId2'],
        height   : '',
        ip       : '127.0.0.1',
        nonce    : '',
        os       : '',
        port     : 1010,
        state    : 2,
        updated  : '',
        version  : '',
      };

      peer.dappid = ['dappId', 'dappId2'];

      const normalized = instance.normalize(Object.assign({}, peer));

      expect(parseIntSpy.calledTwice).to.be.true;
      expect(parseIntSpy.firstCall.args.length).to.equal(2);
      expect(parseIntSpy.firstCall.args[0]).to.equal(peer.port);
      expect(parseIntSpy.firstCall.args[1]).to.equal(0);
      expect(parseIntSpy.getCall(1).args.length).to.equal(2);
      expect(parseIntSpy.getCall(1).args[0]).to.equal(peer.state);
      expect(parseIntSpy.getCall(1).args[1]).to.equal(PeerState.DISCONNECTED);
      expect(normalized).to.deep.equal(expectedPeer);
    });

    it('should return unmuted dappIds array in peer obj with height', () => {
      const expectedPeer = {
        broadhash: '',
        clock    : '',
        dappid   : ['dappId', 'dappId2'],
        height   : 50,
        ip       : '127.0.0.1',
        nonce    : '',
        os       : '',
        port     : 1010,
        state    : 2,
        updated  : '',
        version  : '',
      };
      peer.dappid        = ['dappId', 'dappId2'];
      peer.height        = '50';

      const normalized = instance.normalize(Object.assign({}, peer));

      expect(parseIntSpy.calledThrice).to.be.true;
      expect(parseIntSpy.firstCall.args.length).to.equal(2);
      expect(parseIntSpy.firstCall.args[0]).to.equal(peer.height);
      expect(parseIntSpy.firstCall.args[1]).to.equal(1);
      expect(parseIntSpy.getCall(1).args.length).to.equal(2);
      expect(parseIntSpy.getCall(1).args[0]).to.equal(peer.port);
      expect(parseIntSpy.getCall(1).args[1]).to.equal(0);
      expect(parseIntSpy.getCall(2).args.length).to.equal(2);
      expect(parseIntSpy.getCall(2).args[0]).to.equal(peer.state);
      expect(parseIntSpy.getCall(2).args[1]).to.equal(PeerState.DISCONNECTED);
      expect(normalized).to.deep.equal(expectedPeer);
    });
  });

  describe('parseInt', () => {
    it('should return fallback if val is first parameter is not a number', () => {
      const retVal = instance.parseInt(null, 100);
      expect(retVal).to.equal(100);
    });

    it('should parse integer from string', () => {
      const parseIntSpy = sinon.spy(global, 'parseInt');
      const retVal      = instance.parseInt('200' as any, 100);
      expect(retVal).to.equal(200);
      expect(parseIntSpy.called).to.be.true;
      parseIntSpy.restore();
    });

    it('should parse integer from float', () => {
      const parseIntSpy = sinon.spy(global, 'parseInt');
      const retVal      = instance.parseInt(2.2, 100);
      expect(retVal).to.equal(2);
      expect(parseIntSpy.called).to.be.true;
      parseIntSpy.restore();
    });
  });

  describe('applyHeaders', () => {
    let normalizeSpy: SinonSpy;
    let updateSpy: SinonSpy;

    beforeEach(() => {
      normalizeSpy = sinon.spy(instance, 'normalize');
      updateSpy    = sinon.spy(instance, 'update');
    });

    afterEach(() => {
      normalizeSpy.restore();
      updateSpy.restore();
    });

    it('should call normalize and update', () => {
      const retVal = instance.applyHeaders(undefined);
      expect(retVal).to.deep.equal({ port: 0, state: 1 });
      expect(normalizeSpy.called).to.be.true;
      expect(updateSpy.calledOnce).to.be.true;
    });

    it('should return headers', () => {
      const header = { something: 'header' };
      const retVal = instance.applyHeaders(header as any);
      expect(retVal).to.deep.equal({ port: 0, state: 1, something: 'header' });
      expect(normalizeSpy.called).to.be.true;
      expect(updateSpy.calledOnce).to.be.true;
    });
  });

  describe('update', () => {
    const initialPeerObj = {
      broadhash: '',
      clock    : 1,
      dappid   : '',
      height   : 9999,
      ip       : '1.2.3.4',
      nonce    : 'nonce',
      os       : 'ubuntu',
      port     : 5555,
      state    : PeerState.CONNECTED,
      updated  : 0,
      version  : '1.0',
    };
    beforeEach(() => {
      instance.accept(initialPeerObj);
    });

    it('should not update null or undefined properties', () => {
      instance.update({
        os     : undefined,
        version: null,
      } as any);
      expect(instance.os).to.be.equal(initialPeerObj.os);
      expect(instance.version).to.be.equal(initialPeerObj.version);
    });

    it('should update non-null, non-undefined and non-immutable properties', () => {
      instance.update({
        os     : 'newOs',
        version: 'newVersion',
      } as any);
      expect(instance.os).to.be.equal('newOs');
      expect(instance.version).to.be.equal('newVersion');
    });

    it('should not update immutable properties', () => {
      instance.update({
        ip    : '255.255.255.255',
        port  : '9876',
        string: '1.1.1.1:80',
      } as any);
      expect(instance.ip).to.be.equal(initialPeerObj.ip);
      expect(instance.port).to.be.equal(initialPeerObj.port);
      expect(instance.string).to.be.equal(initialPeerObj.ip + ':' + initialPeerObj.port);
    });

    it('should call normalize', () => {
      const normalizeSpy = sinon.spy(instance, 'normalize');
      instance.update({
        os     : 'newOs',
        version: 'newVersion',
      } as any);
      expect(normalizeSpy.called).to.be.true;
      normalizeSpy.restore();
    });
  });

  describe('object', () => {
    it('returns only supported properties', () => {
      const peer         = {
        broadhash : 'some',
        clock     : 'some',
        dappid    : 'some',
        excluded  : true, // <- this field shouldn't show in the result
        height    : 'some',
        ip        : '127.0.0.1',
        nonce     : 'some',
        nullable  : [
          'os',
          'version',
          'dappid',
          'broadhash',
          'height',
          'clock',
          'updated',
        ],
        os        : 'some',
        port      : '1010',
        properties: [
          'ip',
          'port',
          'state',
          'os',
          'version',
          'dappid',
          'broadhash',
          'height',
          'clock',
          'updated',
          'nonce',
        ],
        state     : '2',
        updated   : 'some',
        version   : 'some',
      };
      const expectedPeer = {
        broadhash: 'some',
        clock    : 'some',
        dappid   : 'some',
        height   : 'some',
        ip       : '127.0.0.1',
        nonce    : 'some',
        os       : 'some',
        port     : '1010',
        state    : '2',
        updated  : 'some',
        version  : 'some',
      };

      const retVal = instance.object.call(peer);

      expect(retVal).to.deep.equal(expectedPeer);
    });
  });

  describe('makeRequest', () => {
    let requestHandlerStub: APIRequestStub;
    let reqData;
    const response = { body: 1, peer: 'peer' };
    beforeEach(() => {
      transportModuleStub.enqueueResponse('getFromPeer', Promise.resolve(response));
      requestHandlerStub = new APIRequestStub();
      requestHandlerStub.enqueueResponse('makeRequest', Promise.resolve(response.body));
      reqData = {data: { transactions: [] }, isProtoBuf: false, method: 'GET', url: '/peer/height'};
      requestHandlerStub.enqueueResponse('getRequestOptions', reqData);
      requestHandlerStub.enqueueResponse('getResponseData', response.body);
    });
    it('should return a promise', () => {
      const retVal = instance.makeRequest(requestHandlerStub);
      expect(retVal).to.be.instanceOf(Promise);
    });

    it('should call reqHandler.makeRequest', async () => {
      const result = await instance.makeRequest(requestHandlerStub);
      expect(requestHandlerStub.stubs.makeRequest.calledOnce).to.be.true;
      expect(requestHandlerStub.stubs.makeRequest.firstCall.args[0]).to.be.deep.eq(instance);
      expect(result).to.be.eq(response.body);
    });
  });

  describe('pingAndUpdate', () => {
    beforeEach(() => {
      instance.version = '1.0.0';
    });
    it('should call makeRequest', () => {
      const makeRequestStub = sinon.stub(instance, 'makeRequest');
      makeRequestStub.resolves('1');
      let p;
      p = instance.pingAndUpdate();
      expect(makeRequestStub.calledOnce).to.be.true;
      expect(makeRequestStub.firstCall.args[0]).to.be.deep.equal(hr);
      expect(p).to.be.fulfilled;
    });

    it('should return a promise', () => {
      transportModuleStub.enqueueResponse('getFromPeer', Promise.resolve({body: '1'}));
      const retVal = instance.pingAndUpdate();
      expect(retVal).to.be.instanceOf(Promise);
    });
  });

  describe('toLogObj', () => {
    it('should call JSON.stringify', () => {
      const stringifySpy = sinon.spy(JSON, 'stringify');
      instance.toLogObj();
      expect(stringifySpy.called).to.be.true;
      stringifySpy.restore();
    });

    it('should call instance.object', () => {
      const objectSpy = sinon.spy(instance, 'object');
      instance.toLogObj();
      expect(objectSpy.called).to.be.true;
      objectSpy.restore();
    });
  });
});
