import { ConstantsType } from '@risevision/core-types';
// tslint:disable object-literal-sort-keys
// TODO: How to split this in submodules?
export const constants: ConstantsType = {
  addressSuffix: '',
  amountBytes: 8,
  epochTime: new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
  minVersion: [
    { height: 1, ver: '>=0.1.0' },
    { height: 241000, ver: '>=0.1.1' },
    { height: 826500, ver: '>=0.1.2' },
  ],
  fees: [
    {
      height: 1,
      fees: {
        send: 10000000,
        vote: 100000000,
        secondsignature: 500000000,
        delegate: 2500000000,
        multisignature: 500000000,
      },
    },
  ],
  maxPeers: 100,
  maxSharedTxs: 100,
  totalAmount: '10999999991000000',
  minBroadhashConsensus: 51,
  unconfirmedTransactionTimeOut: 10800, // 1080 blocks
};
