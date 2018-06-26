export default {
  id        : 'Signature',
  object    : true,
  properties: {
    publicKey: {
      format: 'publicKey',
      type  : 'string',
    },
  },
  required  : ['publicKey'],
};
