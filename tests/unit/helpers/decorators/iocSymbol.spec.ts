import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { IoCSymbol } from '../../../../src/helpers/decorators/iocSymbol';
import { Symbols } from '../../../../src/ioc/symbols';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/decorators/iocSymbol', () => {
  let sandbox: SinonSandbox;
  let defineMetadataSpy;
  let target;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    defineMetadataSpy = sandbox.spy(Reflect, 'defineMetadata');
    target = () => 123;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('IoCSymbol()', () => {
    it('should be return a decorator and call to defineMetadata() successfully', () => {
      const decorator = IoCSymbol(Symbols.api.peers);
      expect(decorator).to.be.an.instanceof(Function);
      expect(defineMetadataSpy.called).to.be.false;
      const result = decorator(target);
      expect(defineMetadataSpy.calledOnce).to.be.true;
      expect(defineMetadataSpy.args[0][0]).to.equal(
        Symbols.__others.metadata.classSymbol
      );
      expect(defineMetadataSpy.args[0][1]).to.equal(Symbols.api.peers);
      expect(defineMetadataSpy.args[0][2]).to.be.an.instanceof(Function);
      expect(target()).to.be.equal(result());
    });
  });
});
