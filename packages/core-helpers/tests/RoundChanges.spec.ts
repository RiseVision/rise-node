import * as chai from 'chai';
import { constants, RoundChanges, Slots } from '../src';

const { expect } = chai;

describe('helpers/RoundChanges', () => {
  const slots = new Slots();
  // Dependency inj
  (slots as any).constants = constants;
  const fullFees = 25 * 101 * 0.1; // 252.5 for a full round with 25 tx per block;
  const fullRewards = [];

  for (let i = 0; i < 101; i++ ) {
    fullRewards.push(15.0);
  }

  it('constructor should floor the roundFees', () => {
    const scope = {
      roundFees: fullFees,
      roundRewards: fullRewards,
    };
    const rc = new RoundChanges(scope, slots);
    expect((rc as any).roundFees).to.be.eq(252);
  });

  it('at() should return the expected calculation values at specific index', () => {
    const scope = {
      roundFees: 102.9,
      roundRewards: fullRewards,
    };
    const rc = new RoundChanges(scope, slots);
    const situation = rc.at(50);
    expect( situation.balance ).to.be.eq(16);
    expect( situation.fees ).to.be.eq(1);
    expect( situation.feesRemaining ).to.be.eq(1);
    expect( situation.rewards ).to.be.eq(15);
  });

  it('at() should hanndle empty round returning all zeroes', () => {
    const scope = {
      roundRewards: [],
    };
    const rc = new RoundChanges(scope, slots);
    const situation = rc.at(50);
    expect( situation.balance ).to.be.eq(0);
    expect( situation.fees ).to.be.eq(0);
    expect( situation.feesRemaining ).to.be.eq(0);
    expect( situation.rewards ).to.be.eq(0);
  });
});
