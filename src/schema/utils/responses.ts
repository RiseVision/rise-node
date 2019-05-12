// tslint:disable object-literal-sort-keys
// tslint:disable trailing-comma
export const respProps = (props = {}) =>
  Object.assign(
    {
      success: { type: 'boolean' },
      error: { type: 'string' }
    },
    props
  );

export const successResp = (example = {}) =>
  Object.assign({ success: true }, example);
