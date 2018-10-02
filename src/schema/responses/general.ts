import { respProps, successResp } from '../utils/responses'

export default {
  deprecated: {
    id: "responses.general.deprecated",
    type: "object",
    properties: respProps(),
    example: {
      success: false,
      error: "Method is deprecated"
    }
  },
  success: {
    id: "responses.general.success",
    type: "object",
    properties: respProps(),
    example: {
      success: true
    }
  },
  error: {
    id: "responses.general.error",
    type: "object",
    properties: respProps(),
    example: {
      success: false,
      error: "An error has occured"
    }
  }
};
