// tslint:disable object-literal-sort-keys
export default {
  id        : 'Block',
  type      : 'object',
  properties: {
    b_id                  : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    b_confirmations       : {
      type  : 'string',
      format: 'positiveIntString',
    },
    b_height              : {
      type  : 'string',
      format: 'positiveIntString',
    },
    b_blockSignature      : {
      type  : 'string',
      format: 'signature',
    },
    b_generatorPublicKey  : {
      type  : 'string',
      format: 'publicKey',
    },
    b_numberOfTransactions: {
      type  : 'string',
      format: 'positiveIntString',
    },
    b_payloadHash         : {
      type  : 'string',
      format: 'hex',
    },
    b_payloadLength       : {
      type  : 'string',
      format: 'positiveIntString',
    },
    b_previousBlock       : {
      anyOf: [{
        type     : 'string',
        format   : 'id',
        minLength: 1,
        maxLength: 20,
      },
        // genesis block has null as previousBlock.
        { type: 'null' },
      ],
    },
    b_timestamp           : {
      type  : 'string',
      format: 'positiveIntString',
    },
    b_totalAmount         : {
      type  : 'string',
      format: 'positiveIntString',
    },
    b_totalFee            : {
      type  : 'string',
      format: 'positiveIntString',
    },
    b_reward              : {
      type  : 'string',
      format: 'positiveIntString',
    },
    b_version             : {
      type  : 'string',
      format: 'positiveIntString',
    },
  },
  required  : ['b_id', 'b_confirmations', 'b_blockSignature', 'b_generatorPublicKey', 'b_height',
    'b_numberOfTransactions', 'b_payloadHash', 'b_payloadLength', 'b_previousBlock', 'b_timestamp',
    'b_totalAmount', 'b_totalFee', 'b_reward', 'b_version'],
};
