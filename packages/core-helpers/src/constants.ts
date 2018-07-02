import { ConstantsType } from '@risevision/core-types';
// tslint:disable object-literal-sort-keys

export const constants: ConstantsType = {
  blockSlotWindow              : 5, // window of which a slot could be accepted.
  blockTime                    : 30,
  blockReceiptTimeOut          : 30 * 2, // 2 blocks
  confirmationLength           : 77,
  epochTime                    : new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
  minVersion                   : [
    { height: 1, ver: '>=0.1.0' },
    { height: 241000, ver: '>=0.1.1' },
    { height: 826500, ver: '>=0.1.2' },
  ],
  fees                         : [
    {
      height: 1,
      fees  : {
        send           : 10000000,
        vote           : 100000000,
        secondsignature: 500000000,
        delegate       : 2500000000,
        multisignature : 500000000,
      },
    },
  ],
  maxAmount                    : 100000000,
  maxPayloadLength             : 1024 * 1024,
  maxPeers                     : 100,
  maxSharedTxs                 : 100,
  maxTxsPerBlock               : 25,
  minBroadhashConsensus        : 51,
  nethashes                    : [
    // Mainnet
    'cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5',
    // Testnet
    'e90d39ac200c495b97deb6d9700745177c7fc4aa80a404108ec820cbeced054c',
  ],
  rewards                      : [
    { height: 1, reward: 0 },
    { height: 10, reward: 1500000000 },
    { height: 11, reward: 30000000 },
    { height: 12, reward: 20000000 },
    { height: 13, reward: 1500000000 },
    { height: 1054080, reward: 1200000000 },
    { height: 1054080 * 2, reward: 900000000 },
    { height: 1054080 * 3, reward: 600000000 },
    { height: 1054080 * 4, reward: 300000000 },
    { height: 1054080 * 5, reward: 100000000 },
  ],
  totalAmount                  : 10999999991000000,
  unconfirmedTransactionTimeOut: 10800, // 1080 blocks
  multisigConstraints          : {
    min      : {
      minimum: 1,
      maximum: 15,
    },
    lifetime : {
      minimum: 1,
      maximum: 72,
    },
    keysgroup: {
      minItems: 1,
      maxItems: 15,
    },
  },
};
