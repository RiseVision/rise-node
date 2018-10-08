import { respProps, successResp } from "../utils/responses";
import { amount } from "../common/scalars";
import { feeHeight } from "../common/fragments";
import { scope } from "../../helpers/strings";

const s = scope('responses.signatures')

export default {
  fees: {
    id: s`fees`,
    type: "object",
    properties: respProps({
      ...feeHeight,
      fee: amount
    }),
    example: successResp({
      fromHeight: 1,
      height: 1362861,
      toHeight: null,
      fee: 500000000
    })
  }
};
