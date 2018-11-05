import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container, injectable } from 'inversify';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import {
  WrapInBalanceSequence,
  WrapInDBSequence,
  WrapInDefaultSequence,
} from '../../../src/decorators';
import { ISequence, Symbols } from '@risevision/core-interfaces';
import { createContainer } from '../../../../core-launchpad/tests/unit/utils/createContainer';

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
  let sequenceStub: ISequence;

  before(async () => {
    container = await createContainer([
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core',
      'core-accounts',
      'core-transactions',
    ]);
  });
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    defineMetadataSpy = sandbox.spy(Reflect, 'defineMetadata');
    target = () => 123;
    sequenceStub = container.getNamed(
      Symbols.helpers.sequence,
      Symbols.names.helpers.dbSequence
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('WrapInBalanceSequence', () => {
    @injectable()
    class Tst {
      public balancesSequence: ISequence = sequenceStub;
      public spy: SinonSpy = sinon.spy();
      @WrapInBalanceSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new Tst();
      const spy = sandbox.spy(tObj.balancesSequence, 'addAndPromise');
      expect(await tObj.method()).to.be.eq('hey');
      expect(spy.calledBefore(tObj.spy)).is.true;
    });
  });
  describe('WrapInDBSequence', () => {
    @injectable()
    class Tst {
      public dbSequence: ISequence = sequenceStub;
      public spy: SinonSpy = sinon.spy();
      @WrapInDBSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new Tst();
      const spy = sandbox.spy(tObj.dbSequence, 'addAndPromise');
      expect(await tObj.method()).to.be.eq('hey');
      expect(spy.calledBefore(tObj.spy)).is.true;
    });
  });
  describe('WrapInDefaultSequence', () => {
    @injectable()
    class Tst {
      public defaultSequence: ISequence = sequenceStub;
      public spy: SinonSpy = sinon.spy();
      @WrapInDefaultSequence
      public async method(): Promise<string> {
        this.spy();
        return 'hey';
      }
    }
    it('should wrap method in balancesSequence', async () => {
      const tObj = new Tst();
      const spy = sandbox.spy(tObj.defaultSequence, 'addAndPromise');
      expect(await tObj.method()).to.be.eq('hey');
      expect(spy.calledBefore(tObj.spy)).is.true;
    });
  });
});
