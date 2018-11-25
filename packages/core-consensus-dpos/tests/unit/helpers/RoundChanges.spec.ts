import * as chai from 'chai';
import { RoundChanges, Slots } from '../../../src/helpers';

const { expect } = chai;

describe('helpers/RoundChanges', () => {
  const slots = new Slots();
  // Dependency inj
  (slots as any).constants = { activeDelegates: 101 };
  const fullFees = BigInt(25 * 101 + 10);
  const fullRewards: Array<bigint> = [];

  for (let i = 0; i < 101; i++) {
    fullRewards.push(15n);
  }

  it('constructor should floor the roundFees', () => {
    const scope = {
      roundFees: fullFees,
      roundRewards: fullRewards,
    };
    const rc = new RoundChanges(scope, slots);
    expect((rc as any).roundFees).to.be.eq(2535n);
  });

  it('at() should return the expected calculation values at specific index', () => {
    const scope = {
      roundFees: 103n,
      roundRewards: fullRewards,
    };
    const rc = new RoundChanges(scope, slots);
    const situation = rc.at(50);
    expect(situation.balance).to.be.eq(16n);
    expect(situation.fees).to.be.eq(1n);
    expect(situation.feesRemaining).to.be.eq(2n);
    expect(situation.rewards).to.be.eq(15n);
  });

  it('at() should hanndle empty round returning all zeroes', () => {
    const scope = {
      roundRewards: [],
    };
    const rc = new RoundChanges(scope, slots);
    const situation = rc.at(50);
    expect(situation.balance).to.be.eq(0n);
    expect(situation.fees).to.be.eq(0n);
    expect(situation.feesRemaining).to.be.eq(0n);
    expect(situation.rewards).to.be.eq(0n);
  });
});
