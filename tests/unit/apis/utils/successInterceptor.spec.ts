import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SuccessInterceptor } from '../../../../src/apis/utils/successInterceptor';
import { Symbols } from '../../../../src/ioc/symbols';
import { createContainer } from '../../../utils/containerCreator';

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
    it('success', () => {
      result = instance.intercept({foo: 'bar'} as any, {myresult: true});
      expect(result).to.deep.equal({ success: true, myresult: true });
    });
  });
});
