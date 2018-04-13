import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { ValidatePeerHeaders } from '../../../../src/apis/utils/validatePeerHeaders';
import { Symbols } from '../../../../src/ioc/symbols';
import {
  PeersLogicStub,
  PeersModuleStub,
  SystemModuleStub,
  ZSchemaStub
} from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import { createFakePeer } from '../../../utils/fakePeersFactory';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/utils/validatePeerHeaders', () => {
  let sandbox: SinonSandbox;
  let instance: ValidatePeerHeaders;
  let container: Container;
  let peersLogicStub: PeersLogicStub;
  let request: any;
  let next: any;
  // tslint:disable prefer-const
  let appConfig: any;
  let systemModuleStub: SystemModuleStub;
  let fakePeer: any;
  let schemaStub: ZSchemaStub;
  let peersModuleStub: PeersModuleStub;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    request = {
      headers: { port: 5555, version: '1.0', nethash: 'zxy' },
      ip: '80.1.2.3',
    };
    next = sandbox.spy();

    // Container
    container = createContainer();
    container.bind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container
      .bind(Symbols.api.utils.validatePeerHeadersMiddleware)
      .to(ValidatePeerHeaders);

    // Instance
    instance = container.get(Symbols.api.utils.validatePeerHeadersMiddleware);

    // systemModuleStub
    systemModuleStub = container.get(Symbols.modules.system);
    systemModuleStub.enqueueResponse('networkCompatible', true);
    systemModuleStub.enqueueResponse('versionCompatible', true);
    systemModuleStub.enqueueResponse('getNethash', 'abcd');
    systemModuleStub.enqueueResponse('getMinVersion', '1.0');

    // peersLogicStub
    peersLogicStub = container.get(Symbols.logic.peers);
    fakePeer = createFakePeer();
    fakePeer.applyHeaders = sandbox.spy();
    peersLogicStub.enqueueResponse('create', fakePeer);
    peersLogicStub.enqueueResponse('upsert', true);
    peersLogicStub.enqueueResponse('remove', true);

    // schemaStub
    schemaStub = container.get(Symbols.generic.zschema);
    schemaStub.enqueueResponse('getLastError', {
      details: [{ path: '/foo/bar' }],
    });
    schemaStub.enqueueResponse('getLastErrors', [{ message: 'Schema error' }]);
    schemaStub.stubs.validate.returns(true);

    // peersModuleStub
    peersModuleStub = container.get(Symbols.modules.peers);
    peersModuleStub.enqueueResponse('update', true);
  });

  describe('use()', () => {
    it('if headers schema is not valid', () => {
      schemaStub.stubs.validate.returns(false);
      instance.use(request, false, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0].message).to.contain('Schema error');
    });

    it('if is NOT networkCompatible', () => {
      systemModuleStub.stubs.networkCompatible.returns(false);
      instance.use(request, false, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0]).to.deep.equal({
        expected: 'abcd',
        message: 'Request is made on the wrong network',
        received: 'zxy',
      });
    });

    it('if version is NOT compatible', () => {
      systemModuleStub.stubs.versionCompatible.returns(false);
      request.headers.version = '3.0';
      instance.use(request, false, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0]).to.deep.equal({
        expected: '1.0',
        message: 'Request is made from incompatible version',
        received: '3.0',
      });
    });

    it('should call to next() without parameters if everything is ok', () => {
      instance.use(request, false, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0]).to.equal(undefined);
      expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
      expect(peersLogicStub.stubs.create.args[0][0]).to.deep.equal({
        ip: '80.1.2.3',
        port: 5555,
      });
      expect(fakePeer.applyHeaders.calledOnce).to.be.true;
      expect(fakePeer.applyHeaders.args[0][0]).to.deep.equal({
        nethash: 'zxy',
        port: 5555,
        version: '1.0',
      });
      expect(peersModuleStub.stubs.update.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.update.args[0][0]).to.deep.equal(fakePeer);
    });
  });
});
