import constants from "../helpers/constants";

export default {
  Buffer: {
    id: "Buffer",
    type: "string",
    format: "binary"
  },
  CSV: {
    id: "CSV",
    type: "string",
    format: "csv"
  },
  id: {
    id: "id",
    type: "string",
    format: "id",
    minLength: 1,
    maxLength: 20
  },
  secret: {
    id: "secret",
    type: "string",
    minLength: 1,
    maxLength: 100
  },
  address: {
    id: "address",
    type: "string",
    format: "address",
    minLength: 1,
    maxLength: 22
  },
  height: {
    id: "height",
    type: "integer",
    minimum: 1
  },
  publicKey: {
    id: "publicKey",
    type: "string",
    format: "publicKey"
  },
  amount: {
    id: "amount",
    type: "integer",
    minimum: 0,
    maximum: constants.totalAmount
  },
  reward: {
    id: "reward",
    type: "integer",
    minimum: 0
  },
  username: {
    id: "username",
    type: "string",
    format: "username",
    minLength: 1,
    maxLength: 20
  },
  query: {
    id: "query",
    type: "string",
    minLength: 1,
    maxLength: 20
  },
  multisigMin: {
    id: "multisigMin",
    type: "integer",
    minimum: constants.multisigConstraints.min.minimum,
    maximum: constants.multisigConstraints.min.maximum
  },
  multisigLifetime: {
    id: "multisigLifetime",
    type: "integer",
    minimum: constants.multisigConstraints.lifetime.minimum,
    maximum: constants.multisigConstraints.lifetime.maximum
  },
  multisigKeysgroup: {
    id: "multisigKeysgroup",
    type: "array",
    minItems: constants.multisigConstraints.keysgroup.minItems,
    maxItems: constants.multisigConstraints.keysgroup.maxItems
  },
  port: {
    id: "port",
    type: "integer",
    minimum: 1,
    maximum: 65535
  },
  ipAddress: {
    id: "ipAddress",
    type: "string",
    format: "ip"
  },
  version: {
    id: "version",
    type: "string",
    format: "version",
    minLength: 5,
    maxLength: 12
  },
  usState: {
    id: "usState",
    type: "integer",
    minimum: 0,
    maximum: 2
  },
  os: {
    id: "os",
    type: "string",
    format: "os",
    minLength: 1,
    maxLength: 64
  },
  hex: {
    id: "hex",
    type: "string",
    format: "hex"
  },
  nonce: {
    id: "nonce",
    type: "string",
    minLength: 16,
    maxLength: 36
  },
  balance: {
    id: "balance",
    type: "number",
    minimum: 0
  },
  signature: {
    id: "signature",
    type: "string",
    format: "binary"
  },
  boolQuery: {
    id: "boolQuery",
    type: "string",
    enum: ["true", "false"]
  }
};
