module.exports = {
  '@risevision/rise': {
    // TODO: changeme
    dposFeesSwitchHeight: 2000000,
    dposRandSwitchRound: 2000000,
  },
  '@risevision/core-accounts': {
    addressRegex: '^(([0-9]{1,20}R)|(rise1[a-zA-HJ-NP-Z0-9]{50,}))$',
  },
  '@risevision/core': {
    amountBytes: 8,
    epochTime: new Date('2016-05-24T17:00:00.000Z'),
    minVersion: [
      {
        height: 1,
        ver: '>=0.1.0',
      },
      {
        height: 241000,
        ver: '>=0.1.1',
      },
      {
        height: 826500,
        ver: '>=0.1.2',
      },
    ],
    fees: [
      {
        height: 1,
        fees: {
          send: 10000000,
          sendDataMultiplier: 1000000,
          vote: 100000000,
          secondsignature: 500000000,
          delegate: 2500000000,
          multisignature: 500000000,
        },
      },
    ],
  },
  '@risevision/core-blocks': {
    maxTxsPerBlock: 25,
    rewards: [
      {
        fromHeight: 1,
        reward: '0',
      },
      {
        fromHeight: 10,
        reward: '1500000000',
      },
      {
        fromHeight: 11,
        reward: '30000000',
      },
      {
        fromHeight: 12,
        reward: '20000000',
      },
      {
        fromHeight: 13,
        reward: '1500000000',
      },
      {
        fromHeight: 1054080,
        reward: '1200000000',
      },
      {
        fromHeight: 2108160,
        reward: '900000000',
      },
      {
        fromHeight: 3162240,
        reward: '600000000',
      },
      {
        fromHeight: 4216320,
        reward: '300000000',
      },
      {
        fromHeight: 5270400,
        reward: '100000000',
      },
    ],
    targetTime: 30,
  },
  '@risevision/core-consensus-dpos': {
    activeDelegates: 101,
    dposv2: {
      delegatesPoolSize: 199,
      firstBlock: 1536312,
      maxContinuousMissedBlocks: 84,
      minForged: 200,
    },
    maxVotesPerTransaction: 2,
    maximumVotes: 1,
  },
  '@risevision/core-p2p': {
    maxPeers: 200,
    maxProtoBufPayloadLength: 102400,
    minBroadhashConsensus: 65,
  },
  '@risevision/core-transactions': {
    maxSharedTxs: 300,
    txTimeout: 10800,
    unconfirmedInPool: 30,
    txIDRegex: '^[0-9]+$',
  },
};
