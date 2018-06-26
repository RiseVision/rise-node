// tslint:disable object-literal-sort-keys

export default {
  headers     : {
    id        : 'transport.headers',
    type      : 'object',
    properties: {
      port     : {
        type   : 'integer',
        minimum: 1,
        maximum: 65535,
      },
      os       : {
        type     : 'string',
        format   : 'os',
        minLength: 1,
        maxLength: 64,
      },
      version  : {
        type     : 'string',
        format   : 'version',
        minLength: 5,
        maxLength: 12,
      },
      nethash  : {
        type     : 'string',
        minLength: 64,
        maxLength: 64,
      },
      broadhash: {
        type  : 'string',
        format: 'hex',
      },
      height   : {
        type   : 'integer',
        minimum: 1,
      },
      nonce    : {
        type     : 'string',
        minLength: 16,
        maxLength: 36,
      },
      firewalled    : {
        type: 'string',
        enum: ['true', 'false'],
      },
    },
    required  : ['port', 'version', 'nethash'],
  },
  commonBlock : {
    id        : 'transport.commonBlock',
    type      : 'object',
    properties: {
      ids: {
        type  : 'string',
        format: 'csv',
      },
    },
    required  : ['ids'],
  },
  blocks      : {
    id        : 'transport.blocks',
    type      : 'object',
    properties: {
      lastBlockId: {
        type     : 'string',
        format   : 'id',
        minLength: 1,
        maxLength: 20,
      },
    },
  },
  transactions: {
    id        : 'transport.transactions',
    type      : 'object',
    properties: {
      transactions: {
        type    : 'array',
        minItems: 1,
        maxItems: 25,
      },
    },
    required  : ['transactions'],
  },
  signatures  : {
    id        : 'transport.signatures',
    type      : 'object',
    properties: {
      signatures: {
        type    : 'array',
        minItems: 1,
        maxItems: 25,
      },
    },
    required  : ['signatures'],
  },
  signature   : {
    id        : 'transport.signature',
    type      : 'object',
    properties: {
      transaction: {
        type     : 'string',
        format   : 'id',
        minLength: 1,
        maxLength: 20,
      },
      signature  : {
        type  : 'string',
        format: 'signature',
      },
    },
    required  : ['transaction', 'signature'],
  },
};
