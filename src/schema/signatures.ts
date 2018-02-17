// tslint:disable object-literal-sort-keys

export default {
  getFee      : {
    id        : 'signatures.getFee',
    type      : 'object',
    properties: {
      height: {
        type   : 'integer',
        minimum: 1,
      },
    },
  },
};
