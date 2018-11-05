import * as chai from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { RoundsLogic } from '../../../src/logic/rounds';
import { dPoSSymbols, Slots } from '../../../src/helpers';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';

const expect = chai.expect;

// tslint:disable no-unused-expression
describe('logic/rounds', () => {
  let sandbox: SinonSandbox;
  let instance: RoundsLogic;
  let slotsStub: Slots;
  let container: Container;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-consensus-dpos',
      'core-helpers',
      'core',
      'core-crypto',
    ]);
    slotsStub = container.get(dPoSSymbols.helpers.slots);
    instance = container.get(dPoSSymbols.logic.rounds);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('calcRound', () => {
    it('should return integer', () => {
      // Prime number
      const retVal = instance.calcRound(9973);
      expect(parseInt(retVal as any, 10)).to.be.equal(retVal);
    });

    it('should the height divided by slots.delegates', () => {
      const height = 9973;
      const retVal = instance.calcRound(height);
      expect(retVal).to.be.equal(Math.ceil(height / slotsStub.delegates));
    });
  });

  describe('heightFromRound', () => {
    const round = 123;

    it('should call firstInRound and lastInRound', () => {
      const firstInRoundSpy = sandbox.spy(instance, 'firstInRound');
      const lastInRoundSpy = sandbox.spy(instance, 'lastInRound');
      instance.heightFromRound(round);
      expect(firstInRoundSpy.calledOnce).to.be.true;
      expect(lastInRoundSpy.calledOnce).to.be.true;
      expect(firstInRoundSpy.firstCall.args[0]).to.be.equal(round);
      expect(lastInRoundSpy.firstCall.args[0]).to.be.equal(round);
      firstInRoundSpy.restore();
      lastInRoundSpy.restore();
    });

    it('should return the expected object', () => {
      const retVal = instance.heightFromRound(round);
      expect(retVal).to.be.deep.equal({
        first: 12323,
        last: 12423,
      });
    });
  });

  describe('firstInRound', () => {
    it('should perform the right calculation and return the expected value', () => {
      expect(instance.firstInRound(123)).to.be.equal(12323);
    });
  });

  describe('lastInRound', () => {
    it('should perform the right calculation and return the expected value', () => {
      expect(instance.lastInRound(123)).to.be.equal(12423);
    });
  });
});
