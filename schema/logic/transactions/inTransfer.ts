// tslint:disable object-literal-sort-keys
export default {
  id        : 'InTransfer',
  object    : true,
  properties: {
    dappId: {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
  },
  required  : ['dappId'],
};
