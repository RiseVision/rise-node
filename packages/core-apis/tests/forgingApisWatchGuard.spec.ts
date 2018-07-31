import { AppConfig } from '@risevision/core-types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { APISymbols, PrivateApisGuard } from '../src/';
import { CoreModule } from '../src'
import { Symbols } from '../../core-interfaces/src';
// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('apis/utils/privateApisWatchGuard', () => {
  let instance: PrivateApisGuard;
  let next: any;
  const request = { ip: '1.1.1.1' };
  const response = {};

  beforeEach(() => {
    const module = new CoreModule();
    module.container = new Container();
    module.initAppElements();

    instance = module.container.getNamed(Symbols.class, APISymbols.privateApiGuard);
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
