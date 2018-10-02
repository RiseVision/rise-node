import { height, hex, wholeNum } from "../common/scalars";
import { successResp, respProps } from "../utils/responses";

export default {
  getStatus: {
    id: "responses.loader.getStatus",
    type: "object",
    properties: respProps({
      loaded: { type: "boolean" }
    }),
    example: successResp({
      loaded: true
    })
  },
  getStatusSync: {
    id: "responses.loader.getStatusSync",
    type: "object",
    properties: respProps({
      broadhash: hex,
      consensus: wholeNum,
      height,
      syncing: { type: "boolean" }
    }),
    example: successResp({
      broadhash: "fa4a803eaf159154de7c4311580debb068ffd178a03dd793c4799fb04a3997bd",
      consensus: 97,
      height: 1356891,
      syncing: false
    })
  },
  ping: {
    id: "responses.loader.ping",
    type: "object",
    properties: respProps(),
    example: successResp()
  }
};
