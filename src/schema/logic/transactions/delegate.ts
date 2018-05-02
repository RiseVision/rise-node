// tslint:disable object-literal-sort-keys
export default {
  id        : 'Delegate',
  type      : 'object',
  properties: {
    username: {
      type: 'string',
      format: 'username',
    },
  },
  required  : ['username'],
};
