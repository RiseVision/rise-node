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
  stringnum,
  username,
  wholeNum,
  ipAddress,
  osState,
  os,
  port,
  version,
  vote,
  transactionType
} from "./scalars";
import { allAssets, multisigAsset } from './fragments'

export const UnconfirmedTransaction = {
  id: "common.models.UnconfirmedTransaction",
  type: "object",
  properties: {
    amount,
    type: transactionType,
    fee: amount,
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
    asset: allAssets
  }
};

export const Transaction = {
  ...UnconfirmedTransaction,
  id: "common.models.Transaction",
  properties: {
    ...UnconfirmedTransaction.properties,
    blockId: id,
    confirmations: wholeNum,
    height
  }
};

export const MultisigTransaction = {
	...Transaction,
	id: 'common.models.MultisigTransaction',
	properties: {
		...Transaction.properties,
		asset: multisigAsset
	}
}

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
    cmb: wholeNum,
    missedblocks: wholeNum,
    producedBlocks: wholeNum,
    productivity: floatnum,
    publicKey,
    rank: countingNum,
    rate: countingNum,
    username,
    vote: stringnum,
    votesWeight: wholeNum
  }
};

export const Peer = {
  id: "common.models.Peer",
  type: "object",
  properties: {
    ip: ipAddress,
    port: port,
    state: osState,
    os,
    version,
    broadhash: hex,
    height: height,
    clock: wholeNum,
    updated: timestamp,
    nonce: "d845b08b-7824-45f3-9033-5317622d0d2f"
  }
};
