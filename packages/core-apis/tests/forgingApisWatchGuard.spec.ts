import { createContainer, LoggerStub } from '@risevision/core-test-utils';
import { AppConfig } from '@risevision/core-types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { PrivateApisGuard } from '../src/';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('apis/utils/privateApisWatchGuard', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: PrivateApisGuard;
  let checkIpInListStub: any;
  let next: any;
  const request = { ip: '1.1.1.1' };
  const response = {};
  let config: AppConfig;

  beforeEach(() => {
    container = createContainer();
    sandbox = sinon.createSandbox();

    container
      .bind(Symbols.api.utils.privateApiGuard)
      .to(ForgingApisWatchGuard)
      .inSingletonScope();

    config = container.get(Symbols.generic.appConfig);

    next = sandbox.spy();
    checkIpInListStub = sandbox.stub(helpers, 'checkIpInList');
    instance = container.get(Symbols.api.utils.privateApiGuard);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('use()', () => {
    it('should call to next() without parameters if everything is ok', () => {
      checkIpInListStub.returns(true);
      instance.use(request as any, response, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0]).to.be.undefined;
      expect(checkIpInListStub.calledOnce).to.be.true;
      expect(checkIpInListStub.args[0][0]).to.equal(
        config.forging.access.whiteList
      );
      expect(checkIpInListStub.args[0][1]).to.equal(request.ip);
    });

    it('should call to next() with an APIError() if checkIpInList() returns false', () => {
      checkIpInListStub.returns(false);
      instance.use(request as any, response, next);
      expect(next.calledOnce).to.be.true;
      expect(next.args[0][0]).to.be.instanceof(APIError);
      expect(next.args[0][0].message).to.be.eq('Delegates API access denied');
      expect(next.args[0][0].statusCode).to.be.eq(403);
      expect(checkIpInListStub.calledOnce).to.be.true;
      expect(checkIpInListStub.args[0][0]).to.equal(
        config.forging.access.whiteList
      );
      expect(checkIpInListStub.args[0][1]).to.equal(request.ip);
    });
  });
});
