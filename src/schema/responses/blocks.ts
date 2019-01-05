import { respProps, successResp } from "../utils/responses";
import { wholeNum, height, amount, hex, datetime } from "../common/scalars";
import { Block } from "../common/models";
import { feeHeight } from "../common/fragments";
import { scope } from "../../helpers/strings";
import { BlockExamples } from "../common/examples";

const s = scope("responses.blocks");

export default {
  getBlock: {
    id: s`getBlock`,
    type: "object",
    properties: respProps({
      block: Block
    }),
    example: successResp({
      block: BlockExamples[0]
    })
  },
  getBlocks: {
    id: s`getBlocks`,
    type: "object",
    properties: respProps({
      blocks: {
        type: "array",
        items: Block
      },
      count: wholeNum
    }),
    example: successResp({
      count: 1356390,
      blocks: BlockExamples
    })
  },
  getHeight: {
    id: s`getHeight`,
    type: "object",
    properties: respProps({
      height
    }),
    example: successResp({
      height: 1356378
    })
  },
  getFee: {
    id: s`getFee`,
    type: "object",
    properties: respProps({
      ...feeHeight,
      fee: amount
    }),
    example: successResp({
      fee: 10000000,
      fromHeight: 1,
      toHeight: null,
      height: 1356378
    })
  },
  getFees: {
    id: s`getFees`,
    type: "object",
    properties: respProps({
      ...feeHeight,
      fees: {
        type: "object",
        properties: {
          send: amount,
          vote: amount,
          secondSignature: amount,
          delegate: amount,
          multisignature: amount
        }
      }
    }),
    example: successResp({
      fees: {
        send: 10000000,
        vote: 100000000,
        secondsignature: 500000000,
        delegate: 2500000000,
        multisignature: 500000000
      },
      fromHeight: 1,
      toHeight: null,
      height: 1356378
    })
  },
  getNethash: {
    id: s`getNethash`,
    type: "object",
    properties: respProps({
      nethash: hex
    }),
    example: successResp({
      nethash: "cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5"
    })
  },
  getMilestone: {
    id: s`getMilestone`,
    type: "object",
    properties: respProps({
      milestone: wholeNum
    }),
    example: successResp({
      milestone: 5
    })
  },
  getReward: {
    id: s`getReward`,
    type: "object",
    properties: respProps({
      reward: amount
    }),
    example: successResp({
      reward: 1200000000
    })
  },
  getEpoch: {
    id: s`getEpoch`,
    type: "object",
    properties: respProps({
      epoch: datetime
    }),
    example: successResp({
      epoch: "2016-05-24T17:00:00.000Z"
    })
  },
  getSupply: {
    id: s`getSupply`,
    type: "object",
    properties: respProps({
      supply: amount
    }),
    example: successResp({
      supply: 12943860841000000
    })
  },
  getBroadHash: {
    id: s`getBroadHash`,
    type: "object",
    properties: respProps({
      broadhash: hex
    }),
    example: successResp({
      broadhash: "ab424cb2d4bbf0a4d97cd055039d7d451ef6512e46ea950dd712645149f209dc"
    })
  },
  getStatus: {
    id: s`getStatus`,
    type: "object",
    properties: respProps({
      broadhash: hex,
      epoch: datetime,
      fee: amount,
      height,
      milestone: wholeNum,
      nethash: hex,
      reward: amount,
      supply: amount
    }),
    example: successResp({
      broadhash: "ab424cb2d4bbf0a4d97cd055039d7d451ef6512e46ea950dd712645149f209dc",
      epoch: "2016-05-24T17:00:00.000Z",
      fee: 10000000,
      height: 1356378,
      milestone: 5,
      nethash: "cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5",
      reward: 1200000000,
      supply: 12943860841000000
    })
  }
};
