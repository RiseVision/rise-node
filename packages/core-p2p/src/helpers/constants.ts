// tslint:disable-next-line
export type P2PConstantsType = {
  broadcastInterval: number;
  broadcastLimit: number;
  maxPeers: number;
  maxProtoBufPayloadLength: number;
  minBroadhashConsensus: number;
  parallelLimit: number;
  relayLimit: number;
  releaseLimit: number;
  stalePeerDataLimit: number;
};

export const constants: P2PConstantsType = {
  broadcastInterval: 5000,
  broadcastLimit: 20,
  maxPeers: 200,
  maxProtoBufPayloadLength: 1572864, // (1.5MB) Maximum number of bytes for a Protocol Buffer Request/Response Body,
  minBroadhashConsensus: 75,
  parallelLimit: 20,
  relayLimit: 2,
  releaseLimit: 25,
  stalePeerDataLimit: 5000, // It's a good idea to set it to a fraction of blocktime
};
