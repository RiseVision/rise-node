import transactionSchema from './logic/transaction';
const transactionItem = {
  ...transactionSchema,
};
delete transactionItem.id;
// tslint:disable object-literal-sort-keys

export default {
  loadSignatures  : {
    id        : 'loader.loadSignatures',
    type      : 'object',
    properties: {
      signatures: {
        type       : 'array',
        uniqueItems: true,
        maxItems   : 100,
        items: {
          type: 'object',
          properties: {
            signatures: {
              type: 'array',
              items: {
                type: 'string',
                format: 'signature',
              },
            },
            transaction: {
              type     : 'string',
              format   : 'id',
              minLength: 1,
              maxLength: 20,
            },
            required  : ['signatures', 'transaction'],
          },
        },
      },
    },
    required  : ['signatures'],
  },
  loadTransactions: {
    id        : 'loader.loadTransactions',
    type      : 'object',
    properties: {
      transactions: {
        type       : 'array',
        uniqueItems: true,
        maxItems   : 100,
        items: transactionItem,
      },
    },
    required  : ['transactions'],
  },
};
