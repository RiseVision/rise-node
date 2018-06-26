// tslint:disable object-literal-sort-keys
export default {
  id        : 'Block',
  type      : 'object',
  properties: {
    id                  : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    height              : {
      type: 'integer',
      minimum: 1,
    },
    blockSignature      : {
      type  : 'object',
      format: 'signatureBuf',
    },
    generatorPublicKey  : {
      type  : 'object',
      format: 'publicKeyBuf',
    },
    numberOfTransactions: {
      type: 'integer',
      minimum: 0,
    },
    payloadHash         : {
      type  : 'object',
      format: 'sha256Buf',
    },
    payloadLength       : {
      type: 'integer',
      minimum: 0,
    },
    previousBlock       : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    timestamp           : {
      type: 'integer',
      minimum: 0,
    },
    totalAmount         : {
      type   : 'integer',
      minimum: 0,
    },
    totalFee            : {
      type   : 'integer',
      minimum: 0,
    },
    reward              : {
      type   : 'integer',
      minimum: 0,
    },
    transactions        : {
      type       : 'array',
    },
    version             : {
      type   : 'integer',
      minimum: 0,
    },
  },
  required  : [
    'blockSignature',
    'generatorPublicKey',
    'height',
    'id',
    'numberOfTransactions',
    'payloadHash',
    'payloadLength',
    'previousBlock',
    'reward',
    'timestamp',
    'totalAmount',
    'totalFee',
    'transactions',
    'version',
  ],
};
