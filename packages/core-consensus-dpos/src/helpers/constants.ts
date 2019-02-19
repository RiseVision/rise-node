// tslint:disable max-line-length
export const constants = {
  activeDelegates: 101,
  dposv2: {
    delegatesPoolSize: 202, // Total number of delegates to choose forgers from, when dposv2 is on. -1 for no limit.
    firstBlock: -1, // Block height from which the fair delegates system will be enabled.
    maxContinuousMissedBlocks: 28 * 3, // Maximum number of missed blocks in a row before banning delegate. A good value might be 3 days,
  },
  maxVotesPerTransaction: 2,
  maximumVotes: 1,
  timeDriftCorrection: 2, // 2 Seconds
};

export type DposConstantsType = typeof constants;
