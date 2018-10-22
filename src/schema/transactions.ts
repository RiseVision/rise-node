// tslint:disable object-literal-sort-keys object-literal-key-quotes
import constants from '../helpers/constants';

export default {
  getTransactions      : {
    id        : 'transactions.getTransactions',
    type      : 'object',
    properties: {
      'and:blockId'         : {
        type     : 'string',
        format   : 'id',
        minLength: 1,
        maxLength: 20,
      },
      blockId               : {
        type     : 'string',
        format   : 'id',
        minLength: 1,
        maxLength: 20,
      },
      'and:type'            : {
        type   : 'integer',
        minimum: 0,
        maximum: 10,
      },
      type                  : {
        type   : 'integer',
        minimum: 0,
        maximum: 10,
      },
      'and:senderId'        : {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
      senderId              : {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
      'and:senderPublicKey' : {
        type  : 'string',
        format: 'publicKey',
      },
      senderPublicKey       : {
        type  : 'string',
        format: 'publicKey',
      },
      'and:recipientId'     : {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
      recipientId           : {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
      senderPublicKeys      : {
        type    : 'array',
        minItems: 1,
        items   : {
          type  : 'string',
          format: 'publicKey',
        },
      },
      senderIds             : {
        type    : 'array',
        minItems: 1,
        items   : {
          type     : 'string',
          format   : 'address',
          minLength: 1,
          maxLength: 22,
        },
      },
      recipientIds          : {
        type    : 'array',
        minItems: 1,
        items   : {
          type     : 'string',
          format   : 'address',
          minLength: 1,
          maxLength: 22,
        },
      },
      'and:fromHeight'      : {
        type   : 'integer',
        minimum: 1,
      },
      fromHeight            : {
        type   : 'integer',
        minimum: 1,
      },
      'and:toHeight'        : {
        type   : 'integer',
        minimum: 1,
      },
      toHeight              : {
        type   : 'integer',
        minimum: 1,
      },
      'and:fromTimestamp'   : {
        type   : 'integer',
        minimum: 0,
      },
      fromTimestamp         : {
        type   : 'integer',
        minimum: 0,
      },
      'and:toTimestamp'     : {
        type   : 'integer',
        minimum: 1,
      },
      toTimestamp           : {
        type   : 'integer',
        minimum: 1,
      },
      'and:fromUnixTime'    : {
        type   : 'integer',
        minimum: (constants.epochTime.getTime() / 1000),
      },
      fromUnixTime          : {
        type   : 'integer',
        minimum: (constants.epochTime.getTime() / 1000),
      },
      'and:toUnixTime'      : {
        type   : 'integer',
        minimum: (constants.epochTime.getTime() / 1000 + 1),
      },
      toUnixTime            : {
        type   : 'integer',
        minimum: (constants.epochTime.getTime() / 1000 + 1),
      },
      'and:minAmount'       : {
        type   : 'integer',
        minimum: 0,
      },
      minAmount             : {
        type   : 'integer',
        minimum: 0,
      },
      'and:maxAmount'       : {
        type   : 'integer',
        minimum: 1,
      },
      maxAmount             : {
        type   : 'integer',
        minimum: 1,
      },
      'and:minConfirmations': {
        type   : 'integer',
        minimum: 0,
      },
      minConfirmations      : {
        type   : 'integer',
        minimum: 0,
      },
      orderBy               : {
        type: 'string',
        enum: [
          'height:desc', 'height:asc',
          'timestamp:desc', 'timestamp:asc',
          'amount:desc', 'amount:asc',
        ],
      },
      limit                 : {
        type   : 'integer',
        minimum: 1,
        maximum: 1000,
      },
      offset                : {
        type   : 'integer',
        minimum: 0,
      },
    },
    additionalProperties: false,
  },
  getTransaction       : {
    id        : 'transactions.getTransaction',
    type      : 'object',
    properties: {
      id: {
        type     : 'string',
        format   : 'id',
        minLength: 1,
        maxLength: 20,
      },
    },
    required  : ['id'],
  },
  getPooledTransaction : {
    id        : 'transactions.getPooledTransaction',
    type      : 'object',
    properties: {
      id: {
        type     : 'string',
        format   : 'id',
        minLength: 1,
        maxLength: 20,
      },
    },
    required  : ['id'],
  },
  getPooledTransactions: {
    id        : 'transactions.getPooledTransactions',
    type      : 'object',
    properties: {
      senderPublicKey: {
        type  : 'string',
        format: 'publicKey',
      },
      address        : {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
    },
  },
  addTransactions      : {
    id        : 'transactions.addTransactions',
    type      : 'object',
    properties: {
      secret                  : {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      amount                  : {
        type   : 'integer',
        minimum: 1,
        maximum: constants.totalAmount,
      },
      recipientId             : {
        type     : 'string',
        format   : 'address',
        minLength: 1,

        maxLength: 22,
      },
      publicKey               : {
        type  : 'string',
        format: 'publicKey',
      },
      secondSecret            : {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      multisigAccountPublicKey: {
        type  : 'string',
        format: 'publicKey',
      },
    },
    required  : ['secret', 'amount', 'recipientId'],
  },
  put                  : {
    id        : 'transactions.put',
    type      : 'object',
    properties: {
      transaction : {
        type: 'object'
      },
      transactions: {
        type    : 'array',
        maxItems: 10
      },
    },
  },
};
