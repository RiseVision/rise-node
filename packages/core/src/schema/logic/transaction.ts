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
      minimum: 0,
    },
    senderPublicKey   : {
      type  : 'object',
      format: 'publicKeyBuf',
    },
    requesterPublicKey: {
      type  : 'object',
      format: 'publicKeyBuf',
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
      type  : 'object',
      format: 'signatureBuf',
    },
    signSignature     : {
      type  : 'object',
      format: 'signatureBuf',
    },
    asset             : {
      type: 'object',
    },
  },
  required  : ['type', 'timestamp', 'senderId', 'senderPublicKey', 'signature', 'fee', 'amount'],
};
