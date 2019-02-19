// tslint:disable-next-line
export type ConstantsType = {
  amountBytes: number;
  epochTime: Date;
  fees: Array<{ height: number; fees: { [type: string]: number } }>;
  minVersion: Array<{ height: number; ver: string }>;
  // minBroadhashConsensus: number;
};
