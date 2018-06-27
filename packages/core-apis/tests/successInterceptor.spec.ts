import { createContainer, LoggerStub } from '@risevision/core-test-utils';
import { Symbols } from '@risevision/core-helpers';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SuccessInterceptor } from '../src';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/utils/attachPeerHeaders', () => {
  let instance: SuccessInterceptor;
  let container: Container;
  let result: any;

  beforeEach(() => {
    container = createContainer();
    container.bind(Symbols.api.utils.successInterceptor).to(SuccessInterceptor);
    instance = container.get(Symbols.api.utils.successInterceptor);
  });

  describe('intercept()', () => {
    it('should return an object parameter result with {success: true} object', () => {
      result = instance.intercept({foo: 'bar'} as any, {myresult: true});
      expect(result).to.deep.equal({ success: true, myresult: true });
    });
  });
});
