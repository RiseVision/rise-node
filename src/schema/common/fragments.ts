import {
  height,
  username,
  publicKey,
  vote,
  multisigMin,
  multisigLifetime,
  multisigKeysgroup
} from "./scalars";

export const feeHeight = {
  fromHeight: height,
  toHeight: height,
  height
};

export const delegateAsset = {
  type: "object",
  properties: {
    delegate: {
      type: "object",
      properties: {
        username
      }
    }
  }
};

export const votesAsset = {
  type: "object",
  properties: {
    votes: {
      type: "array",
      items: vote
    }
  }
};

export const signatureAsset = {
  type: "object",
  properties: {
    signature: {
      type: "object",
      properties: {
        publicKey
      }
    }
  }
};

export const multisigAsset = {
  type: "object",
  properties: {
    multisig: {
      min: multisigMin,
      lifetime: multisigLifetime,
      keysgroup: multisigKeysgroup
    }
  }
};

export const allAssets = {
  type: "object",
  properties: {
    ...multisigAsset.properties,
    ...signatureAsset.properties,
    ...votesAsset.properties,
    ...delegateAsset.properties
  }
};
