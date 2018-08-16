import { ConstantsType } from '@risevision/core-types';

export const constants = {
  activeDelegates              : 101,
  maxVotesPerTransaction       : 2,
  maximumVotes                 : 1,
};

export type DposConstantsType = typeof constants & ConstantsType
  ;
