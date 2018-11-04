import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { APISymbols, PrivateApisGuard } from '../../src';
import { Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { APIConfig } from '../../src';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('apis/utils/privateApisWatchGuard', () => {
  let instance: PrivateApisGuard;
  let next: SinonStub;
  const request  = { ip: '1.1.1.1' };
  const response = {};
  let container: Container;
  beforeEach(async () => {
    container = await createContainer(['core-apis', 'core', 'core-accounts', 'core-helpers', 'core-crypto']);
    instance  = container.getNamed(APISymbols.class, APISymbols.privateApiGuard);
    next      = sinon.stub();
  });
  describe('use()', () => {
    it('should call to next() without or with parameters depending on the ip check', () => {
      const config                          = container.get<APIConfig>(Symbols.generic.appConfig);
      config.api.access.restrictedWhiteList = ['8.8.8.8'];
      instance.use({ ip: '8.8.8.8' } as any, response, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args).deep.eq([]);

      next.resetHistory();
      instance.use({ ip: '8.8.8.7' } as any, response, next);
      expect(next.firstCall.args[0].statusCode).eq(403);
    });
  });
});
