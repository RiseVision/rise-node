import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { AttachPeerHeaders } from '../../../../src/apis/utils/attachPeerHeaders';
import { Symbols } from '../../../../src/ioc/symbols';
import { createContainer } from '../../../utils/containerCreator';

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

  beforeEach(() => {
    container = createContainer();
    container.bind(Symbols.api.utils.attachPeerHeaderToResponseObject).to(AttachPeerHeaders);
    sandbox = sinon.createSandbox();
    response = {set: () => true};
    responseSpy = sandbox.spy(response, 'set');
    request = {};
    next = sandbox.spy();
    instance = container.get(Symbols.api.utils.attachPeerHeaderToResponseObject);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('use()', () => {
    it('should call to response.set() and next()', () => {
      instance.use(request, response, next);
      expect(responseSpy.calledOnce).to.be.true;
      expect(responseSpy.args[0][0]).to.equal(undefined);
      expect(next.calledOnce).to.be.true;
    });
  });
});
