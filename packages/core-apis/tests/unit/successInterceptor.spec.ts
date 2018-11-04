import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { APISuccessInterceptor } from '../../src';
import { APISymbols } from '../../src';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/utils/attachPeerHeaders', () => {
  let instance: APISuccessInterceptor;
  let container: Container;
  let result: any;

  beforeEach(async () => {
    container = await createContainer(['core-apis', 'core', 'core-helpers', 'core-crypto', 'core-accounts']);
    container.bind(APISymbols.successInterceptor).to(APISuccessInterceptor);
    instance = container.get(APISymbols.successInterceptor);
  });

  describe('intercept()', () => {
    it('should return an object parameter result with {success: true} object', () => {
      result = instance.intercept({ foo: 'bar' } as any, { myresult: true });
      expect(result).to.deep.equal({ success: true, myresult: true });
    });
  });
});
