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
    },
    blockSignature      : {
      type  : 'string',
      format: 'signature',
    },
    generatorPublicKey  : {
      type  : 'string',
      format: 'publicKey',
    },
    numberOfTransactions: {
      type: 'integer',
    },
    payloadHash         : {
      type  : 'string',
      format: 'hex',
    },
    payloadLength       : {
      type: 'integer',
    },
    previousBlock       : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    timestamp           : {
      type: 'integer',
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
      uniqueItems: true,
      maxItems: 25,
      items: {
        type      : 'object',
        // Minimal schema to initially verify that mandatory fields are valid. Transactions are then revalidated
        properties: {
          id                : {
            type     : 'string',
            format   : 'id',
            minLength: 1,
            maxLength: 20,
          },
          type              : {
            type: 'integer',
          },
          timestamp         : {
            type: 'integer',
          },
          senderPublicKey   : {
            type  : 'string',
            format: 'publicKey',
          },
          signature         : {
            type  : 'string',
            format: 'signature',
          },
        },
        required  : ['type', 'timestamp', 'senderPublicKey', 'signature'],
      },
    },
    version             : {
      type   : 'integer',
      minimum: 0,
    },
  },
  required  : ['blockSignature', 'generatorPublicKey',
    'numberOfTransactions', 'payloadHash', 'payloadLength',
    'timestamp', 'totalAmount', 'totalFee', 'reward', 'transactions', 'version'],
  // "additionalProperties": false
};
