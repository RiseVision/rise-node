import {
  hex,
  id,
  publicKey,
  height,
  wholeNum,
  timestamp,
  signature,
  amount
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

export const Fees = {
  id: "common.models.Fee",
  type: "object",
  properties: {
    send: amount,
    vote: amount,
    secondSignature: amount,
    delegate: amount,
    multisignature: amount
  }
};
