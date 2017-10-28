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
  addSignature: {
    id        : 'signatures.addSignature',
    type      : 'object',
    properties: {
      secret                  : {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      secondSecret            : {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      publicKey               : {
        type  : 'string',
        format: 'publicKey',
      },
      multisigAccountPublicKey: {
        type  : 'string',
        format: 'publicKey',
      },
    },
    required  : ['secret', 'secondSecret'],
  },
};
