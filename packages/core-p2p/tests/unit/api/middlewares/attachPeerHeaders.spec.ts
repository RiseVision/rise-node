import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { AttachPeerHeaders } from '../../../../src/api/middlewares/';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { p2pSymbols } from '../../../../src/helpers';
import { ISystemModule, Symbols } from '@risevision/core-interfaces';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/utils/attachPeerHeaders', () => {
  let sandbox: SinonSandbox;
  let instance: AttachPeerHeaders;
  let request: any;
  let response: any;
  let responseSpy: any;
  let next: any;
  let container: Container;

  beforeEach(async () => {
    container = await createContainer(['core-p2p', 'core-helpers', 'core-crypto', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
    sandbox = sinon.createSandbox();
    response = {set: () => true};
    responseSpy = sandbox.spy(response, 'set');
    request = {};
    next = sandbox.spy();
    instance = container.getNamed(p2pSymbols.transportMiddleware, p2pSymbols.transportMiddlewares.attachPeerHeaders);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('use()', () => {
    it('should call to response.set() and next()', () => {
      const systemModule = container.get<ISystemModule>(Symbols.modules.system);
      instance.use(request, response, next);
      expect(responseSpy.calledOnce).to.be.true;
      expect(responseSpy.args[0][0]).to.deep.equal(systemModule.headers);
      expect(next.calledOnce).to.be.true;
    });
  });
});
