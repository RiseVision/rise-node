import { respProps, successResp } from "../utils/responses";
import { wholeNum, id, publicKey } from "../common/scalars";
import { Transaction, MultisigTransaction, UnconfirmedTransaction } from "../common/models";
import { TransactionType } from "../../helpers";
import { scope } from "../utils/scope";
import {
  TransactionExamples,
  UnconfirmedTransactionExamples
} from "../common/examples";

const s = scope("responses.transactions");

const list = model => ({
  count: wholeNum,
  transactions: {
    type: "array",
    items: model
  }
});

const item = model => ({
  transaction: model
});

export default {
  getTransactions: {
    id: s`getTransactions`,
    type: "object",
    properties: respProps(list(Transaction)),
    example: successResp({
      count: 563381,
      transactions: TransactionExamples
    })
  },
  getCount: {
    id: s`getCount`,
    type: "object",
    properties: respProps({
      confirmed: wholeNum,
      multisignature: wholeNum,
      queued: wholeNum,
      unconfirmed: wholeNum
    }),
    example: successResp({
      confirmed: 563381,
      multisignature: 0,
      queued: 1,
      unconfirmed: 1
    })
  },
  getTransaction: {
    id: s`getTransaction`,
    type: "object",
    properties: respProps({
      transaction: {
        ...Transaction,
        properties: {
          ...Transaction.properties,
          votes: {
            type: "object",
            properties: {
              added: {
                type: "array",
                items: publicKey
              },
              deleted: {
                type: "array",
                items: publicKey
              }
            }
          }
        }
      }
    }),
    example: successResp({
      transaction: {
        ...TransactionExamples[TransactionType.VOTE],
        votes: {
          added: TransactionExamples[TransactionType.VOTE].asset.votes.map(v =>
            v.slice(1)
          ),
          deleted: []
        }
      }
    })
  },
  getMultiSigs: {
    id: s`getMultiSigs`,
    type: "object",
    properties: respProps(list(MultisigTransaction)),
    example: successResp({
      count: 102,
      transactions: [TransactionExamples[TransactionType.MULTI]]
    })
  },
  getMultiSig: {
    id: s`getMultiSig`,
    type: "object",
    properties: respProps(item(MultisigTransaction)),
    example: successResp({
      transaction: TransactionExamples[TransactionType.MULTI]
    })
  },
  getQueuedTransactions: {
    id: s`getQueuedTransactions`,
    type: "object",
    properties: respProps(list(UnconfirmedTransaction)),
    example: successResp({
      count: 5,
      transaction: UnconfirmedTransactionExamples
    })
  },
  getQueuedTransaction: {
    id: s`getQueuedTransaction`,
    type: "object",
    properties: respProps(item(UnconfirmedTransaction)),
    example: successResp({
      transaction: UnconfirmedTransactionExamples[0]
    })
  },
  getUnconfirmedTransactions: {
    id: s`getUnconfirmedTransactions`,
    type: "object",
    properties: respProps(list(UnconfirmedTransaction)),
    example: successResp({
      count: 5,
      transaction: UnconfirmedTransactionExamples
    })
  },
  getUnconfirmedTransaction: {
    id: s`getUnconfirmedTransaction`,
    type: "object",
    properties: respProps(item(UnconfirmedTransaction)),
    example: successResp({
      transaction: UnconfirmedTransactionExamples[0]
    })
  },
  localCreate: {
    id: s`localCreate`,
    type: "object",
    properties: respProps({
      transactionId: id
    }),
    example: successResp({
      transactionId: "6920969059388666996"
    })
  },
  put: {
    id: s`put`,
    type: "object",
    properties: respProps({
      accepted: {
        type: "array",
        items: id
      },
      invalid: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id,
            reason: { type: "string" }
          }
        }
      }
    }),
    example: successResp({
      accepted: ["6920969059388666996"],
      invalid: [
        {
          id: "6059220831601703385",
          reason: "Failed to validated transaction schema"
        }
      ]
    })
  }
};
