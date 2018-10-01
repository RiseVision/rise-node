export const respProps = (props = {}) =>
  Object.assign(
    {
      success: { type: "boolean" },
      error: { type: "string" }
    },
    props
  );

export const successResp = (example = {}) => Object.assign({ success: true }, example);

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
