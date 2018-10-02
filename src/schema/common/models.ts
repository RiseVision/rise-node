import {
  address,
  amount,
  countingNum,
  floatnum,
  height,
  hex,
  id,
  publicKey,
  signature,
  timestamp,
  username,
  wholeNum
} from "./scalars";

export const Transaction = {
  id: "common.models.Transaction",
  type: "object",
  properties: {
    amount,
    blockId: id,
    confirmations: wholeNum,
    fee: amount,
    height,
    id,
    recipientId: id,
    requesterPublicKey: publicKey,
    rowId: wholeNum,
    senderId: id,
    senderPublicKey: publicKey,
    signSignature: signature,
    signature,
    signatures: {
      type: "array",
      items: signature
    },
    timestamp,
    type: wholeNum
  }
};

export const Block = {
  id: "common.models.Block",
  type: "object",
  properties: {
    blockSignature: hex,
    generatorPublicKey: publicKey,
    height,
    id,
    numberOfTransactions: wholeNum,
    payloadHash: hex,
    payloadLength: wholeNum,
    previousBlock: id,
    reward: wholeNum,
    rowId: wholeNum,
    timestamp: wholeNum,
    totalAmount: amount,
    totalFee: amount,
    Transactions: {
      type: "array",
      items: Transaction
    },
    version: wholeNum
  }
};

export const Delegate = {
  id: "common.models.Delegate",
  type: "object",
  properties: {
    address,
    approval: floatnum,
    missedblocks: wholeNum,
    producedBlocks: wholeNum,
    productivity: floatnum,
    publicKey,
    rank: countingNum,
    rate: countingNum,
    username,
    vote: wholeNum
  }
};
