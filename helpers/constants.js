'use strict';

module.exports = {
	currentVersion: "0.1.0",
	minVersion: [
		{ height: 1,      ver: "^0.1.0"}
	],
	activeDelegates: 101,
	maximumVotes: 1,
	addressLength: 208,
	blockHeaderLength: 248,
	blockTime: 30000,
	blockReceiptTimeOut: 30*2, // 2 blocks
	confirmationLength: 77,
	epochTime: new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
	fees: {
		send: 10000000,
		vote: 100000000,
		secondsignature: 500000000,
		delegate: 2500000000,
		multisignature: 500000000,
		dapp: 2500000000
	},
	feeStart: 1,
	feeStartVolume: 10000 * 100000000,
	fixedPoint: Math.pow(10, 8),
	maxAddressesLength: 208 * 128,
	maxAmount: 100000000,
	maxConfirmations: 77 * 100,
	maxPayloadLength: 1024 * 1024,
	maxPeers: 100,
	maxRequests: 10000 * 12,
	maxSharedTxs: 100,
	maxSignaturesLength: 196 * 256,
	maxTxsPerBlock: 25,
	minBroadhashConsensus: 51,
	nethashes: [
		// Mainnet
		'cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5',
		// Testnet
		'e90d39ac200c495b97deb6d9700745177c7fc4aa80a404108ec820cbeced054c'
	],
	numberLength: 100000000,
	requestLength: 104,
	rewards: {
		milestones: [
            150000000,  // Initial reward
            120000000,  // Milestone 1
            90000000,   // Milestone 2
            60000000,   // Milestone 3
            30000000,   // Milestone 4
            10000000    // Milestone 5
		],
		offset: 10,   // Start rewards at block (n)
		distance: 1054080, // Distance between each milestone ~ 1 year
	},
	signatureLength: 196,
	totalAmount: 10999999991000000,
	unconfirmedTransactionTimeOut: 10800 // 1080 blocks
};
