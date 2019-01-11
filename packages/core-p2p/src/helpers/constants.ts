// tslint:disable-next-line
export type P2PConstantsType = {
  broadcastInterval: number;
  broadcastLimit: number;
  maxPeers: number;
  maxProtoBufPayloadLength: number; // (1.5MB) Maximum number of bytes for a Protocol Buffer Request/Response Body,
  minBroadhashConsensus: number;
  minVersion: Array<{ height: string; ver: string }>;
  parallelLimit: number;
  relayLimit: number;
  releaseLimit: number;
};

export const constants: P2PConstantsType = {
  broadcastInterval: 5000,
  broadcastLimit: 20,
  maxPeers: 100,
  maxProtoBufPayloadLength: 1572864, // (1.5MB) Maximum number of bytes for a Protocol Buffer Request/Response Body,
  minBroadhashConsensus: 75,
  minVersion: [],
  parallelLimit: 20,
  relayLimit: 2,
  releaseLimit: 25,
};
