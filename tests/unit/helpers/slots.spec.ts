import * as chai from 'chai';
import { constants, Slots } from '../../../src/helpers';

const { expect } = chai;

describe('helpers/slots', () => {
  const slots = new Slots();
  // Dependency inj
  (slots as any).constants = constants;

  // Test case: 3 hours after epochTime
  const testDate = new Date(constants.epochTime.getTime() + 9 + 27 * 100 * 1000);
  const testTimestamp = testDate.getTime();

  it('getTime() should return the number of seconds elapsed since epochTime to the passed timestamp', () => {
    const retVal = slots.getTime(testTimestamp);
    expect(retVal).to.be.eq( 27 * 100 );
  });

  it('getSlotNumber() should return the number of slot based on time given', () => {
    const retVal = slots.getSlotNumber(testTimestamp);
    expect(retVal).to.be.eq( 54226366667 );
    expect(slots.getSlotTime(retVal)).to.be.eq(testTimestamp);
  });

  it('getSlotTime() should return the timestamp for a specific SlotNumber', () => {
    // Just one slot later
    const retVal = slots.getSlotTime(54226366667 + 1 );
    expect(retVal).to.be.eq( testTimestamp + constants.blockTime );
  });

  it('getLastSlot() should return the SlotNumber for the last slot in round', () => {
    const retVal = slots.getLastSlot(48804000000 );
    expect(retVal).to.be.eq( 48804000000 + constants.activeDelegates );
  });

  it('getDelegatesPoolSize() should return activeDelegates before dposv2 activation', () => {
    const retVal = slots.getDelegatesPoolSize(constants.dposv2.firstBlock - 1);
    expect(retVal).to.be.equal(constants.activeDelegates);
  });

  it('getDelegatesPoolSize() should return constants.dposv2.delegatesPoolSize after dposv2 activation', () => {
    const retVal = slots.getDelegatesPoolSize(constants.dposv2.firstBlock);
    expect(retVal).to.be.equal(constants.dposv2.delegatesPoolSize);
  });

});
