// tslint:disable object-literal-sort-keys
import constants from '../../helpers/constants';

export default {
  id        : 'Transaction',
  type      : 'object',
  properties: {
    id                : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    height            : {
      type: 'integer',
    },
    blockId           : {
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
    requesterPublicKey: {
      type  : 'string',
      format: 'publicKey',
    },
    senderId          : {
      type     : 'string',
      format   : 'address',
      minLength: 1,
      maxLength: 22,
    },
    recipientId       : {
      type     : 'string',
      format   : 'address',
      minLength: 1,
      maxLength: 22,
    },
    amount            : {
      type   : 'integer',
      minimum: 0,
      maximum: constants.totalAmount,
    },
    fee               : {
      type   : 'integer',
      minimum: 0,
      maximum: constants.totalAmount,
    },
    signature         : {
      type  : 'string',
      format: 'signature',
    },
    signSignature     : {
      type  : 'string',
      format: 'signature',
    },
    asset             : {
      type: 'object',
    },
  },
  required  : ['type', 'timestamp', 'senderPublicKey', 'signature'],
};
