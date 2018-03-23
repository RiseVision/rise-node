// tslint:disable object-literal-sort-keys
export default {
  id        : 'Delegate',
  type      : 'object',
  properties: {
    publicKey: {
      type  : 'string',
      format: 'publicKey',
    },
    username: {
      type: 'string',
      format: 'username',
    },
  },
  required  : ['publicKey', 'username'],
};
