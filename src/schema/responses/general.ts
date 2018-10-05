import { respProps, successResp } from '../utils/responses'
import { scope } from '../utils/scope'

const s = scope('responses.general')

export default {
  deprecated: {
    id: s`deprecated`,
    type: "object",
    properties: respProps(),
    example: {
      success: false,
      error: "Method is deprecated"
    }
  },
  success: {
    id: s`success`,
    type: "object",
    properties: respProps(),
    example: {
      success: true
    }
  },
  error: {
    id: s`error`,
    type: "object",
    properties: respProps(),
    example: {
      success: false,
      error: "An error has occured"
    }
  },
  accessDenied: {
    id: s`accessDenied`,
    type: "object",
    properties: respProps(),
    example: {
      success: false,
      error: "Secure API Access Denied"
    }
  }
};
