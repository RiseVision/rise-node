import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { APIError } from '../../../../src/apis/errors';
import { ForgingApisWatchGuard } from '../../../../src/apis/utils/forgingApisWatchGuard';
import * as helpers from '../../../../src/helpers';
import { Symbols } from '../../../../src/ioc/symbols';
import { AppConfig } from '../../../../src/types/genericTypes';
import { createContainer } from '../../../utils/containerCreator';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('apis/utils/forgingApisWatchGuard', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: ForgingApisWatchGuard;
  let checkIpInListStub: any;
  let next: any;
  const request = { ip: '1.1.1.1' };
  const response = {};
  let config: AppConfig;

  beforeEach(() => {
    container = createContainer();
    sandbox = sinon.sandbox.create();

    container
      .bind(Symbols.api.utils.forgingApisWatchGuard)
      .to(ForgingApisWatchGuard)
      .inSingletonScope();

    config = container.get(Symbols.generic.appConfig);

    next = sandbox.spy();
    checkIpInListStub = sandbox.stub(helpers, 'checkIpInList');
    instance = container.get(Symbols.api.utils.forgingApisWatchGuard);
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
