export const constants = {
  maxSharedTxs: 300,
  txTimeout: 60 * 60 * 24 * 2,
  unconfirmedInPool: 30, // Set to - at least - block size
};

export type TxConstantsType = typeof constants;
