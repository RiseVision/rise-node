import constants from "../../helpers/constants";

export const CSV = {
  id: "common.scalars.CSV",
  type: "string",
  format: "csv"
};

export const id = {
  id: "common.scalars.id",
  type: "string",
  format: "id",
  minLength: 1,
  maxLength: 20
};

export const secret = {
  id: "common.scalars.secret",
  type: "string",
  minLength: 1,
  maxLength: 100
};

export const address = {
  id: "common.scalars.address",
  type: "string",
  format: "address",
  minLength: 1,
  maxLength: 22
};

export const height = {
  id: "common.scalars.height",
  type: "integer",
  minimum: 1
};

export const publicKey = {
  id: "common.scalars.publicKey",
  type: "string",
  format: "publicKey"
};

export const amount = {
  id: "common.scalars.amount",
  type: "integer",
  minimum: 0,
  maximum: constants.totalAmount
};

export const reward = {
  id: "common.scalars.reward",
  type: "integer",
  minimum: 0
};

export const username = {
  id: "common.scalars.username",
  type: "string",
  format: "username",
  minLength: 1,
  maxLength: 20
};

export const query = {
  id: "common.scalars.query",
  type: "string",
  minLength: 1,
  maxLength: 20
};

export const multisigMin = {
  id: "common.scalars.multisigMin",
  type: "integer",
  minimum: constants.multisigConstraints.min.minimum,
  maximum: constants.multisigConstraints.min.maximum
};

export const multisigLifetime = {
  id: "common.scalars.multisigLifetime",
  type: "integer",
  minimum: constants.multisigConstraints.lifetime.minimum,
  maximum: constants.multisigConstraints.lifetime.maximum
};

export const multisigKeysgroup = {
  id: "common.scalars.multisigKeysgroup",
  type: "array",
  minItems: constants.multisigConstraints.keysgroup.minItems,
  maxItems: constants.multisigConstraints.keysgroup.maxItems
};

export const port = {
  id: "common.scalars.port",
  type: "integer",
  minimum: 1,
  maximum: 65535
};

export const ipAddress = {
  id: "common.scalars.ipAddress",
  type: "string",
  format: "ip"
};

export const version = {
  id: "common.scalars.version",
  type: "string",
  format: "version",
  minLength: 5,
  maxLength: 12
};

export const usState = {
  id: "common.scalars.usState",
  type: "integer",
  minimum: 0,
  maximum: 2
};

export const os = {
  id: "common.scalars.os",
  type: "string",
  format: "os",
  minLength: 1,
  maxLength: 64
};

export const hex = {
  id: "common.scalars.hex",
  type: "string",
  format: "hex"
};

export const nonce = {
  id: "common.scalars.nonce",
  type: "string",
  minLength: 16,
  maxLength: 36
};

export const balance = {
  id: "common.scalars.balance",
  type: "string"
};

export const signature = {
  id: "common.scalars.signature",
  type: "string",
  format: "binary"
};

export const boolInt = {
  id: "common.scalars.boolInt",
  type: "integer",
  enum: [1, 0]
};

export const boolQuery = {
  id: "common.scalars.boolQuery",
  type: "string",
  enum: ["true", "false"]
};

export const wholeNum = {
  id: "common.scalars.wholeNum",
  type: "integer",
  minimum: 0
};

export const countingNum = {
  id: "common.scalars.countingNum",
  type: "integer",
  minimum: 1
};

export const timestamp = {
  id: "common.scalars.timestamp",
  type: "integer",
  minimum: 1
};

export const datetime = {
  id: "common.scalars.datetime",
  type: "string",
  format: "date-time"
};

export const stringnum = {
  id: "common.scalars.stringnum",
  type: "string",
  format: "stringnum"
};

export const floatnum = {
  type: "number",
  format: "float"
};
