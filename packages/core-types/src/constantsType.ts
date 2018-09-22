// tslint:disable-next-line
export type ConstantsType = {
  addressSuffix: string,
  blockSlotWindow: number,
  blockTime: number,
  blockReceiptTimeOut: number, // 2 blocks
  confirmationLength: number,
  epochTime: Date,
  minVersion: Array<{ height: number, ver: string }>
  fees: Array<{ height: number, fees: { [type: string]: number } }>,
  maxAmount: number,
  maxPayloadLength: number,
  maxPeers: number,
  maxSharedTxs: number,
  maxTxsPerBlock: number,
  minBroadhashConsensus: number,
  nethashes: string[]
  rewards: Array<{ height: number, reward: number }>
  totalAmount: number,
  unconfirmedTransactionTimeOut: number, // 1080 blocks
};
