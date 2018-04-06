import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { ForgingApisWatchGuard } from '../../../../src/apis/utils/forgingApisWatchGuard';
import { Symbols } from '../../../../src/ioc/symbols';
import { AppConfig } from '../../../../src/types/genericTypes';
import { createContainer } from '../../../utils/containerCreator';
import { APIError } from '../../../../src/apis/errors';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);
const forgingApis = rewire('../../../../src/apis/utils/forgingApisWatchGuard');

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
    const helpers = forgingApis.__get__('helpers_1');
    checkIpInListStub = sandbox.stub(helpers, 'checkIpInList');
    instance = container.get(Symbols.api.utils.forgingApisWatchGuard);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('use()', () => {
    it('success', () => {
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

    it('error', () => {
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
