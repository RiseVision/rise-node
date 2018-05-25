import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {Container, injectable} from 'inversify';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import {
  WrapInBalanceSequence,
  WrapInDBSequence,
  WrapInDefaultSequence
} from '../../../../src/helpers/decorators/wrapInSequence';
import { Symbols } from '../../../../src/ioc/symbols';
import { SequenceStub } from '../../../stubs';
import {createContainer} from '../../../utils/containerCreator';

// tslint:disable next-line no-var-requires max-classes-per-file
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/decorators/wrapInSequence', () => {
  let sandbox: SinonSandbox;
  let defineMetadataSpy;
  let target;
  let container: Container;
  let sequenceStub: SequenceStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    container = createContainer();
    defineMetadataSpy = sandbox.spy(Reflect, 'defineMetadata');
    target = () => 123;
    sequenceStub = container.getTagged(Symbols.helpers.sequence,
      Symbols.helpers.sequence, Symbols.tags.helpers.dbSequence);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('WrapInBalanceSequence', () => {
    @injectable()
    class Tst {
      public balancesSequence: any = sequenceStub;
      public spy: SinonSpy = sinon.spy();
      @WrapInBalanceSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new Tst();
      expect(await tObj.method()).to.be.eq('hey');
      expect(tObj.balancesSequence.spies.addAndPromise.calledBefore(tObj.spy)).is.true;
    });
  });
  describe('WrapInDBSequence', () => {
    @injectable()
    class Tst {
      public dbSequence: any = sequenceStub;
      public spy: SinonSpy = sinon.spy();
      @WrapInDBSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new Tst();
      expect(await tObj.method()).to.be.eq('hey');
      expect(tObj.dbSequence.spies.addAndPromise.calledBefore(tObj.spy)).is.true;
    });
  });
  describe('WrapInDefaultSequence', () => {
    @injectable()
    class Tst {
      public defaultSequence: any = sequenceStub;
      public spy: SinonSpy = sinon.spy();
      @WrapInDefaultSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new Tst();
      expect(await tObj.method()).to.be.eq('hey');
      expect(tObj.defaultSequence.spies.addAndPromise.calledBefore(tObj.spy)).is.true;
    });
  });
});
