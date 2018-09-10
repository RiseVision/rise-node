import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { ValidatePeerHeaders } from '../../../src/api/middlewares/';
import { p2pSymbols, PeersLogic } from '../../../src';
import { IPeersModule, ISystemModule, Symbols } from '@risevision/core-interfaces';
import { createContainer } from '../../../../core-launchpad/tests/utils/createContainer';
import { createFakePeer } from '../../utils/fakePeersFactory';

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
  let peersLogicStub: PeersLogic;
  let request: any;
  let next: any;
  // tslint:disable prefer-const
  let appConfig: any;
  let systemModuleStub: ISystemModule;
  let fakePeer: any;
  let schemaStub: any;
  let peersModuleStub: IPeersModule;
  let lastErrorStub: SinonStub;
  let getLastErrorsStub: SinonStub;
  let validateStub: SinonStub;
  let peersModuleUpdateStub: SinonStub;
  let peersLogicCreateStub: SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    request = {
      headers: { port: 5555, version: '1.0.0', nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6' },
      ip: '80.1.2.3',
    };
    next = sandbox.spy();

    // Container
    container = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
    container.bind(Symbols.generic.appConfig).toConstantValue(appConfig);
    // Instance
    instance = container.get(p2pSymbols.api.validatePeerHeadersMiddleware);

    // systemModuleStub
    systemModuleStub = container.get(Symbols.modules.system);

    // peersLogicStub
    peersLogicStub = container.get(Symbols.logic.peers);
    fakePeer = createFakePeer();
    fakePeer.applyHeaders = sandbox.spy();
    peersLogicCreateStub = sandbox.stub(peersLogicStub, 'create').returns(fakePeer);
    // peersLogicStub.enqueueResponse('upsert', true);
    // peersLogicStub.enqueueResponse('remove', true);

    // schemaStub
    schemaStub = container.get(Symbols.generic.zschema);
    lastErrorStub = sandbox.stub(schemaStub, 'getLastError').returns({
      details: [{ path: '/foo/bar' }],
    });
    getLastErrorsStub = sandbox.stub(schemaStub, 'getLastErrors').returns([{ message: 'Schema error' }]);
    validateStub = sandbox.stub(schemaStub, 'validate').returns(true);

    // peersModuleStub
    peersModuleStub = container.get(Symbols.modules.peers);
    peersModuleUpdateStub = sandbox.stub(peersModuleStub, 'update').returns(true);
    const blocksModule = container.get<any>(Symbols.modules.blocks);
    blocksModule.lastBlock = { height: 10 };
  });

  describe('use()', () => {
    it('if headers schema is not valid', () => {
      validateStub.returns(false);
      instance.use(request, false, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0].message).to.contain('Schema error');
    });

    it('if is NOT networkCompatible', () => {
      request.headers.nethash = 'zxy';
      instance.use(request, false, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0]).to.deep.equal({
        expected: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
        message: 'Request is made on the wrong network',
        received: 'zxy',
      });
    });

    it('if version is NOT compatible', () => {
      sandbox.stub(systemModuleStub, 'versionCompatible').returns(false);
      request.headers.version = '3.0';
      instance.use(request, false, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0]).to.deep.equal({
        expected: '>=0.1.0',
        message: 'Request is made from incompatible version',
        received: '3.0',
      });
    });

    it('should call to next() without parameters if everything is ok', () => {
      instance.use(request, false, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0]).to.equal(undefined);
      expect(peersLogicCreateStub.calledOnce).to.be.true;
      expect(peersLogicCreateStub.args[0][0]).to.deep.equal({
        ip: '80.1.2.3',
        port: 5555,
      });
      expect(fakePeer.applyHeaders.calledOnce).to.be.true;
      expect(fakePeer.applyHeaders.args[0][0]).to.deep.equal({
        nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
        port: 5555,
        version: '1.0.0',
      });
      expect(peersModuleUpdateStub.calledOnce).to.be.true;
      expect(peersModuleUpdateStub.args[0][0]).to.deep.equal(fakePeer);
    });
  });
});
