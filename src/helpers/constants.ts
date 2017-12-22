// tslint:disable object-literal-sort-keys

/**
 * @namespace constants
 * @memberof module:helpers
 * @property {number} activeDelegates - The default number of delegates.
 * @property {number} maxVotesPerTransaction - The maximum number of votes in vote type transaction.
 * @property {number} addressLength - The default address length.
 * @property {number} blockHeaderLength - The default block header length.
 * @property {number} blockReceiptTimeOut
 * @property {number} confirmationLength
 * @property {Date} epochTime
 * @property {object} fees - The default values for fees.
 * @property {number} fees.send
 * @property {number} fees.vote
 * @property {number} fees.secondsignature
 * @property {number} fees.delegate
 * @property {number} fees.multisignature
 * @property {number} fees.dapp
 * @property {number} feeStart
 * @property {number} feeStartVolume
 * @property {number} fixedPoint
 * @property {number} maxAddressesLength
 * @property {number} maxAmount
 * @property {number} maxConfirmations
 * @property {number} maxPayloadLength
 * @property {number} maxPeers
 * @property {number} maxRequests
 * @property {number} maxSharedTxs
 * @property {number} maxSignaturesLength
 * @property {number} maxTxsPerBlock
 * @property {number} minBroadhashConsensus
 * @property {string[]} nethashes - Mainnet and Testnet.
 * @property {number} numberLength
 * @property {number} requestLength
 * @property {object} rewards
 * @property {number[]} rewards.milestones - Initial 5, and decreasing until 1.
 * @property {number} rewards.offset - Start rewards at block (n).
 * @property {number} rewards.distance - Distance between each milestone
 * @property {number} signatureLength
 * @property {number} totalAmount
 * @property {number} unconfirmedTransactionTimeOut - 1080 blocks
 */
export default {
  activeDelegates              : 101,
  maximumVotes                 : 1,
  maxVotesPerTransaction       : 2,
  addressLength                : 208,
  blockHeaderLength            : 248,
  blockTime                    : 30,
  blockReceiptTimeOut          : 30 * 2, // 2 blocks
  confirmationLength           : 77,
  epochTime                    : new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
  minVersion                   : [
    { height: 1, ver: '^0.1.0' },
    { height: 241000, ver: '^0.1.1' },
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
        dapp           : 2500000000,
      },
    },
  ],
  feeStart                     : 1,
  feeStartVolume               : 10000 * 100000000,
  fixedPoint                   : Math.pow(10, 8),
  maxAddressesLength           : 208 * 128,
  maxAmount                    : 100000000,
  maxConfirmations             : 77 * 100,
  maxPayloadLength             : 1024 * 1024,
  maxPeers                     : 100,
  maxRequests                  : 10000 * 12,
  maxSharedTxs                 : 100,
  maxSignaturesLength          : 196 * 256,
  maxTxsPerBlock               : 25,
  minBroadhashConsensus        : 51,
  nethashes                    : [
    // Mainnet
    'cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5',
    // Testnet
    'e90d39ac200c495b97deb6d9700745177c7fc4aa80a404108ec820cbeced054c',
  ],
  numberLength                 : 100000000,
  requestLength                : 104,
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
  signatureLength              : 196,
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
