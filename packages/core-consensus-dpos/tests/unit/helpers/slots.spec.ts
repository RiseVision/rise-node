import { BlocksConstantsType, BlocksSymbols } from '@risevision/core-blocks';
import { Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ConstantsType } from '@risevision/core-types';
import * as chai from 'chai';
import { DposConstantsType, dPoSSymbols, Slots } from '../../../src/helpers';

const { expect } = chai;

describe('helpers/slots', () => {
  let instance: Slots;
  let constants: ConstantsType;
  let blocksConstants: BlocksConstantsType;
  let dposConstants: DposConstantsType;
  // Dependency inj
  // (slots as any).constants = {};

  // Test case: 3 hours after epochTime
  // const testDate = new Date(constants.epochTime.getTime() + 3 * 3600 * 1000);
  // const testTimestamp = testDate.getTime();

  let testTimestamp: number;
  beforeEach(async () => {
    const container = await createContainer([
      'core-consensus-dpos',
      'core-helpers',
      'core-crypto',
    ]);
    instance = container.get(dPoSSymbols.helpers.slots);
    constants = container.get(Symbols.generic.constants);
    blocksConstants = container.get(BlocksSymbols.constants);
    dposConstants = container.get(dPoSSymbols.constants);
    const testDate = new Date(constants.epochTime.getTime() + 3 * 3600 * 1000);
    testTimestamp = testDate.getTime();
  });

  it('getTime() should return the number of seconds elapsed since epochTime to the passed timestamp', () => {
    const retVal = instance.getTime(testTimestamp);
    expect(retVal).to.be.eq(3 * 3600);
  });

  it('getSlotNumber() should return the number of slot based on time given', () => {
    const retVal = instance.getSlotNumber(testTimestamp);
    expect(retVal).to.be.eq(48804000000);
  });

  it('getSlotTime() should return the timestamp for a specific SlotNumber', () => {
    // Just one slot later
    const retVal = instance.getSlotTime(48804000001);
    expect(retVal).to.be.eq(testTimestamp + blocksConstants.targetTime);
  });

  it('getLastSlot() should return the SlotNumber for the last slot in round', () => {
    const retVal = instance.getLastSlot(48804000000);
    expect(retVal).to.be.eq(48804000000 + dposConstants.activeDelegates);
  });
});
