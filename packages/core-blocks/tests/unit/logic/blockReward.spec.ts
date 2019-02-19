import { Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import * as chai from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import {
  BlockRewardLogic,
  BlocksConstantsType,
  BlocksSymbols,
} from '../../../src/';

const expect = chai.expect;

// tslint:disable no-unused-expression
describe('logic/blockReward', () => {
  let instance: BlockRewardLogic;
  let sandbox: SinonSandbox;
  let container: Container;
  let constants: BlocksConstantsType;
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-blocks',
      'core-helpers',
      'core-crypto',
      'core',
      'core-accounts',
      'core-transactions',
    ]);
    instance = container.get(BlocksSymbols.logic.blockReward);
    constants = container.get(BlocksSymbols.constants);
    constants.rewards = [
      { fromHeight: 1, reward: '0' },
      { fromHeight: 10, reward: '1500000000' },
      { fromHeight: 11, reward: '30000000' },
      { fromHeight: 12, reward: '20000000' },
      { fromHeight: 13, reward: '1500000000' },
      { fromHeight: 1054080, reward: '1200000000' },
      { fromHeight: 1054080 * 2, reward: '900000000' },
      { fromHeight: 1054080 * 3, reward: '600000000' },
      { fromHeight: 1054080 * 4, reward: '300000000' },
      { fromHeight: 1054080 * 5, reward: '100000000' },
    ];
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('[protected] rewards', () => {
    it('should get rewards from constants', () => {
      expect((instance as any).rewards).to.be.deep.equal([
        { fromHeight: 1, reward: 0n },
        { fromHeight: 10, reward: 1500000000n },
        { fromHeight: 11, reward: 30000000n },
        { fromHeight: 12, reward: 20000000n },
        { fromHeight: 13, reward: 1500000000n },
        { fromHeight: 1054080, reward: 1200000000n },
        { fromHeight: 2108160, reward: 900000000n },
        { fromHeight: 3162240, reward: 600000000n },
        { fromHeight: 4216320, reward: 300000000n },
        { fromHeight: 5270400, reward: 100000000n },
      ]);
    });
  });

  describe('private.parseHeight', () => {
    it('should return error if height is not a number', () => {
      expect(() => (instance as any).parseHeight('string')).to.throw(
        'Invalid block height'
      );
    });

    it('should return a positive integer', () => {
      expect((instance as any).parseHeight(-1237)).to.eq(1237);
    });
  });

  describe('calcMilestone', () => {
    it('should call parseHeight', () => {
      const parseHeightStub = sandbox
        .stub(instance as any, 'parseHeight')
        .returns(1);

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
      const calcMilestoneStub = sandbox
        .stub(instance, 'calcMilestone')
        .returns(0);

      instance.calcReward(10);

      expect(calcMilestoneStub.calledOnce).to.be.true;
      expect(calcMilestoneStub.getCall(0).args.length).to.equal(1);
      expect(calcMilestoneStub.getCall(0).args[0]).to.equal(10);
    });
  });

  describe('calcSupply', () => {
    it('should call parseHeight', () => {
      const parseHeightStub = sandbox
        .stub(instance as any, 'parseHeight')
        .returns(10);
      instance.calcSupply(10);

      expect(parseHeightStub.getCall(0).args.length).to.equal(1);
      expect(parseHeightStub.getCall(0).args[0]).to.equal(10);
    });

    it('should call calcMilestone', () => {
      const calcMilestoneStub = sandbox
        .stub(instance, 'calcMilestone')
        .returns(1);
      instance.calcSupply(1);

      expect(calcMilestoneStub.getCall(0).args.length).to.equal(1);
      expect(calcMilestoneStub.getCall(0).args[0]).to.equal(1);
    });

    const tests = [
      { height: 10, supply: 11000001491000000n },
      { height: 11, supply: 11000001491000000n + 30000000n },
      { height: 12, supply: 11000001491000000n + 30000000n + 20000000n },
      {
        height: 13,
        supply: 11000001491000000n + 30000000n + 20000000n + 1500000000n,
      },
      {
        height: 100,
        // tslint:disable-next-line
        supply:
          11000001491000000n +
          30000000n +
          20000000n +
          // tslint:disable-next-line
          1500000000n * (100n - 12n),
      },
    ];
    tests.forEach((supplyTest) => {
      it(`should return correct supply for height ${supplyTest.height}`, () => {
        expect(instance.calcSupply(supplyTest.height)).to.equal(
          supplyTest.supply
        );
      });
    });
  });
});
