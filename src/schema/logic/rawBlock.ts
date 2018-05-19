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
    b_height              : {
      type  : 'integer',
      mininmum: 1,
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
      type  : 'integer',
      minimum: 0,
    },
    b_payloadHash         : {
      type  : 'string',
      format: 'hex',
    },
    b_payloadLength       : {
      type  : 'integer',
      minimum: 0,
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
      type  : 'integer',
      minimum: 0,
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
      type  : 'integer',
      minimum: 0,
    },
    t_id       : {
      anyOf: [
        {
          type     : 'string',
          format   : 'id',
          minLength: 1,
          maxLength: 20,
        },
        { type: 'null' },
      ],
    },
    t_type : {
      anyOf: [
        {
          type     : 'integer',
          minimum: 1,
          maximum: 7,
        },
        { type: 'null' },
      ],
    },
    t_timestamp : {
      anyOf: [
        {
          type     : 'integer',
          minimum: 0,
        },
        { type: 'null' },
      ],
    },
    t_senderPublicKey : {
      anyOf: [
        {
          type     : 'string',
          format: 'publicKey',
        },
        { type: 'null' },
      ],
    },
    t_senderId : {
      anyOf: [
        {
          type     : 'string',
          format: 'address',
        },
        { type: 'null' },
      ],
    },
    t_recipientId : {
      anyOf: [
        {
          type     : 'string',
          format: 'address',
        },
        { type: 'null' },
      ],
    },
    t_amount : {
      anyOf: [
        {
          type     : 'string',
          format: 'positiveIntString',
        },
        { type: 'null' },
      ],
    },
    t_fee : {
      anyOf: [
        {
          type     : 'string',
          format: 'positiveIntString',
        },
        { type: 'null' },
      ],
    },
    t_signature : {
      anyOf: [
        {
          type     : 'string',
          format: 'signature',
        },
        { type: 'null' },
      ],
    },
    t_signSignature : {
      anyOf: [
        {
          type     : 'string',
          format: 'signature',
        },
        { type: 'null' },
      ],
    },
    s_publicKey : {
      anyOf: [
        {
          type     : 'string',
          format: 'publicKey',
        },
        { type: 'null' },
      ],
    },
    d_username : {
      anyOf: [
        {
          type     : 'string',
          format: 'username',
        },
        { type: 'null' },
      ],
    },
    v_votes : {
      anyOf: [
        {
          type     : 'string',
          format: 'rawVotes',
        },
        { type: 'null' },
      ],
    },
    m_min : {
      anyOf: [
        {
          type     : 'integer',
          minimum: 1,
        },
        { type: 'null' },
      ],
    },
    m_lifetime : {
      anyOf: [
        {
          type     : 'integer',
          minimum: 0,
        },
        { type: 'null' },
      ],
    },
    m_keysgroup : {
      anyOf: [
        {
          type     : 'string',
          format: 'rawKeysgroup',
        },
        { type: 'null' },
      ],
    },
    t_requesterPublicKey: {
      anyOf: [
        {
          type     : 'string',
          format: 'publicKey',
        },
        { type: 'null' },
      ],
    },
    t_signatures: {
      anyOf: [
        {
          type     : 'string',
          format: 'rawSignatures',
        },
        { type: 'null' },
      ],
    },

  },
  required  : ['b_id', 'b_blockSignature', 'b_generatorPublicKey', 'b_height',
    'b_numberOfTransactions', 'b_payloadHash', 'b_payloadLength', 'b_previousBlock', 'b_timestamp',
    'b_totalAmount', 'b_totalFee', 'b_reward', 'b_version', 't_id', 't_type', 't_timestamp',
    't_senderPublicKey', 't_requesterPublicKey', 't_senderId', 't_recipientId', 't_signature',
    't_signSignature',
  ],
};
