// tslint:disable-next-line
export type ConstantsType = {
  addressSuffix: string;
  epochTime: Date;
  minVersion: Array<{ height: number; ver: string }>;
  fees: Array<{ height: number; fees: { [type: string]: number } }>;
  maxAmount: number;
  maxPeers: number;
  maxSharedTxs: number;
  totalAmount: string;
  minBroadhashConsensus: number;
  unconfirmedTransactionTimeOut: number; // 1080 blocks
};
