export const respProps = (props = {}) =>
  Object.assign(
    {
      success: { type: "boolean" },
      error: { type: "string" }
    },
    props
  );

export const successResp = (example = {}) =>
  Object.assign({ success: true }, example);
