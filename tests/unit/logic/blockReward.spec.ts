import * as chai from 'chai';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { constants } from '../../../src/helpers';
import { BlockRewardLogic } from '../../../src/logic';

const expect = chai.expect;

// tslint:disable no-unused-expression
describe('logic/blockReward', () => {
  let instance: BlockRewardLogic;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    instance = new BlockRewardLogic();
    (instance as any).constants = constants;
    // Usually autocalled by inversify on construct
    instance.initRewards();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize rewards to the constant', () => {
      expect((instance as any).rewards).to.be.deep.equal(constants.rewards);
    });
  });

  describe('private.parseHeight', () => {
    it('should return error if height is not a number', () => {
      expect(() => (instance as any).parseHeight('string')).to.throw('Invalid block height');
    });

    it('should return a positive integer', () => {
      expect((instance as any).parseHeight(-1237)).to.eq(1237);
    });
  });

  describe('calcMilestone', () => {
    it('should call parseHeight', () => {
      const parseHeightStub = sandbox.stub((instance as any), 'parseHeight').returns(1);

      instance.calcMilestone(10);

      expect(parseHeightStub.calledOnce).to.be.true;
      expect(parseHeightStub.getCall(0).args.length).to.equal(1);
      expect(parseHeightStub.getCall(0).args[0]).to.equal(10);
    });

    it('should return correct block height', () => {
      expect(instance.calcMilestone(1)).to.equal(0);
    });
    it('should return 0 index if correct block not found', () => {
      expect(instance.calcMilestone(0)).to.equal(0);
    });
  });

  describe('calcReward', () => {
    it('should call calcMilestone', () => {
      const calcMilestoneStub = sandbox.stub(instance, 'calcMilestone').returns(0);

      instance.calcReward(10);

      expect(calcMilestoneStub.calledOnce).to.be.true;
      expect(calcMilestoneStub.getCall(0).args.length).to.equal(1);
      expect(calcMilestoneStub.getCall(0).args[0]).to.equal(10);
    });
  });

  describe('calcSupply', () => {

    it('should call parseHeight', () => {
      const parseHeightStub = sandbox.stub((instance as any), 'parseHeight').returns(10);
      instance.calcSupply(10);

      expect(parseHeightStub.getCall(0).args.length).to.equal(1);
      expect(parseHeightStub.getCall(0).args[0]).to.equal(10);
    });

    it('should call calcMilestone', () => {
      const calcMilestoneStub = sandbox.stub(instance, 'calcMilestone').returns(1);
      instance.calcSupply(1);

      expect(calcMilestoneStub.getCall(0).args.length).to.equal(1);
      expect(calcMilestoneStub.getCall(0).args[0]).to.equal(1);
    });

    const tests = [
      { height: 10, supply: 11000000141000000 },
      { height: 11, supply: 11000000141000000 + 30000000 },
      { height: 12, supply: 11000000141000000 + 30000000 + 20000000 },
      { height: 13, supply: 11000000141000000 + 30000000 + 20000000 + 150000000 },
      { height: 100, supply: 11000000141000000 + 30000000 + 20000000 + 150000000 * (100 - 12) },
    ];
    tests.forEach((supplyTest) => {
      it(`should return correct supply for height ${supplyTest.height}`, () => {
        expect(instance.calcSupply(supplyTest.height)).to.equal(supplyTest.supply);
      });
    });

  });
});
