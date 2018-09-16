export const constants = {
  broadcastInterval       : 5000,
  broadcastLimit          : 20,
  maxProtoBufPayloadLength: 1572864, // (1.5MB) Maximum number of bytes for a Protocol Buffer Request/Response Body,
  parallelLimit           : 20,
  relayLimit              : 2,
  releaseLimit            : 25,
};

export type P2PConstantsType = typeof constants;
