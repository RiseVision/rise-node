import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import { IoCSymbol } from '../../../../src/helpers/decorators/iocSymbol';
import { Symbols } from '../../../../src/ioc/symbols';
import { Sequence } from '../../../../src/helpers';
import { injectable } from 'inversify';
import {
  WrapInBalanceSequence,
  WrapInDBSequence,
  WrapInDefaultSequence
} from '../../../../src/helpers/decorators/wrapInSequence';
import { SequenceStub } from '../../../stubs';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/decorators/wrapInSequence', () => {
  let sandbox: SinonSandbox;
  let defineMetadataSpy;
  let target;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    defineMetadataSpy = sandbox.spy(Reflect, 'defineMetadata');
    target = () => 123;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('WrapInBalanceSequence', () => {
    @injectable()
    class tst {
      public balancesSequence: any = new SequenceStub();
      public spy: SinonSpy = sinon.spy();
      @WrapInBalanceSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new tst();
      expect(await tObj.method()).to.be.eq('hey');
      expect(tObj.balancesSequence.spies.addAndPromise.calledBefore(tObj.spy.firstCall)).is.true;
    });
  });
  describe('WrapInDBSequence', () => {
    @injectable()
    class tst {
      public dbSequence: any = new SequenceStub();
      public spy: SinonSpy = sinon.spy();
      @WrapInDBSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new tst();
      expect(await tObj.method()).to.be.eq('hey');
      expect(tObj.dbSequence.spies.addAndPromise.calledBefore(tObj.spy.firstCall)).is.true;
    });
  });
  describe('WrapInDefaultSequence', () => {
    @injectable()
    class tst {
      public defaultSequence: any = new SequenceStub();
      public spy: SinonSpy = sinon.spy();
      @WrapInDefaultSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new tst();
      expect(await tObj.method()).to.be.eq('hey');
      expect(tObj.defaultSequence.spies.addAndPromise.calledBefore(tObj.spy.firstCall)).is.true;
    });
  });
});
