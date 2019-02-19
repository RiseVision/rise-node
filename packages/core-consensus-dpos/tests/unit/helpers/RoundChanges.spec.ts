import * as chai from 'chai';
import { RoundChanges, Slots } from '../../../src/helpers';

const { expect } = chai;

describe('helpers/RoundChanges', () => {
  const fullRewards: Array<bigint> = [];

  for (let i = 0; i < 101; i++) {
    fullRewards.push(15n);
  }

  it('at() should return the expected calculation values at specific index', () => {
    const scope = {
      roundFees: new Array(101).fill(0).map((a, idx) => BigInt(idx)),
      roundRewards: fullRewards,
    };
    const rc = new RoundChanges(scope);
    for (let i = 0; i < 101; i++) {
      const situation = rc.at(i);
      expect(situation.balance).to.be.eq(BigInt(i) + 15n);
      expect(situation.fees).to.be.eq(BigInt(i));
      expect(situation.rewards).to.be.eq(15n);
    }
  });

  it('at() should hanndle empty round returning all zeroes', () => {
    const scope = {
      roundFees: [],
      roundRewards: [],
    };
    const rc = new RoundChanges(scope);
    const situation = rc.at(50);
    expect(situation.balance).to.be.eq(0n);
    expect(situation.fees).to.be.eq(0n);
    expect(situation.rewards).to.be.eq(0n);
  });
});
