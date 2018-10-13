import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { BaseTransportMethod } from '../../../src/requests';
import { ProtoBufHelperStub } from '../stubs/protobufhelperStub';
import { PeerType } from '@risevision/core-types';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { p2pSymbols } from '../../../src/helpers';
import { createFakePeer } from '../utils/fakePeersFactory';

class TestRequest extends BaseTransportMethod<any, any, any> {
  public readonly method = 'POST';
  public readonly baseUrl = '/test/';
}

const factory = (what: (new () => any)) => (ctx) => (options) => {
  const toRet = ctx.container.resolve(what);
  toRet.options = options;
  return toRet;
};

// tslint:disable no-unused-expression max-line-length
describe('apis/requests/BaseTransportMethod', () => {
  let sandbox: SinonSandbox;
  let instance: TestRequest;
  let container: Container;
  let protoBufStub: ProtoBufHelperStub;
  let peer: PeerType;
  const testSymbol = Symbol('testRequest');

  beforeEach(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
    container.bind(p2pSymbols.transportMethod).to(TestRequest).inSingletonScope().whenTargetNamed(testSymbol);
    container.rebind(p2pSymbols.helpers.protoBuf).to(ProtoBufHelperStub).inSingletonScope();
    protoBufStub = container.get(p2pSymbols.helpers.protoBuf);
    peer = createFakePeer();
    instance = container.getNamed(p2pSymbols.transportMethod, testSymbol);
  });

  afterEach(() => {
    sandbox.restore();
  });

  // TODO: Create tests.
  //
  // describe('unwrapResponse', () => {
  //
  //   describe('when response status is 200', () => {
  //     it('should call pdecodeProtoBufValidResponse and return if it message is validated', () => {
  //       protoBufStub.stubs.decode.onFirstCall().returns({success: true});
  //       const decpbvrStub = sandbox.stub(instance as any, 'decodeProtoBufValidResponse').returns('decodedResult');
  //       const resp = (instance as any).unwrapResponse(Buffer.from('', 'hex'));
  //       expect(decpbvrStub.calledOnce).to.be.true;
  //       expect(decpbvrStub.firstCall.args[0]).to.be.deep.equal(Buffer.from('', 'hex'));
  //       expect(resp).to.be.equal('decodedResult');
  //     });
  //   });
  //
  //   describe('when response is an error', () => {
  //     const res = {status: 200, body: Buffer.from('', 'hex')};
  //     it('should try first to parse the request as an API error', () => {
  //       const err = {success: false, error: 'thisIsAnErr'};
  //       protoBufStub.stubs.decode.returns(err);
  //       protoBufStub.stubs.decodeToObj.throws(new Error('decodeToObjError'));
  //       let resp;
  //       expect(() => {
  //         resp = (instance as any).unwrapResponse(res, 'namespace', 'messageType');
  //       }).to.throw('thisIsAnErr');
  //     });
  //   });
  // });

});
