import { respProps, successResp } from "../utils/responses";
import { wholeNum, height, amount } from "../common/scalars";
import { Block, Fees } from "../common/models";

export default {
  getBlock: {
    id: "responses.blocks.getBlock",
    type: "object",
    properties: respProps({
      block: Block
    })
  },
  getBlocks: {
    id: "responses.blocks.getBlocks",
    type: "object",
    properties: respProps({
      blocks: {
        type: "array",
        items: Block
      },
      count: wholeNum
    })
  },
  getHeight: {
    id: "responses.blocks.getHeight",
    type: "object",
    properties: respProps({
      height
    })
  },
  getFee: {
    id: "responses.blocks.getFee",
    type: "object",
    properties: respProps({
      fee: amount,
      fromHeight: height,
      toHeight: height,
      height
    })
  },
  getFees: {
    id: "responses.blocks.getFees",
    type: "object",
    properties: respProps({
      fees: Fees,
      fromHeight: height,
      toHeight: height,
      height
    })
  }
};
