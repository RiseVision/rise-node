// tslint:disable object-literal-sort-keys
import constants from '../helpers/constants';

export default {
  enableForging     : {
    id        : 'delegates.enableForging',
    type      : 'object',
    properties: {
      secret   : {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      publicKey: {
        type  : 'string',
        format: 'publicKey',
      },
    },
    required  : ['secret'],
  },
  disableForging    : {
    id        : 'delegates.disableForging',
    type      : 'object',
    properties: {
      secret   : {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      publicKey: {
        type  : 'string',
        format: 'publicKey',
      },
    },
    required  : ['secret'],
  },
  forgingStatus     : {
    id        : 'delegates.forgingStatus',
    type      : 'object',
    properties: {
      publicKey: {
        type  : 'string',
        format: 'publicKey',
      },
    },
  },
  getDelegate       : {
    id        : 'delegates.getDelegate',
    type      : 'object',
    properties: {
      publicKey: {
        type: 'string',
        format: 'publicKey',
      },
      username : {
        type     : 'string',
        format   : 'username',
        minLength: 1,
        maxLength: 20,
      },
    },
  },
  search            : {
    id        : 'delegates.search',
    type      : 'object',
    properties: {
      q    : {
        type     : 'string',
        minLength: 1,
        maxLength: 20,
      },
      limit: {
        type   : 'integer',
        minimum: 1,
        maximum: 1000,
      },
    },
    required  : ['q'],
  },
  getVoters         : {
    id        : 'delegates.getVoters',
    type      : 'object',
    properties: {
      publicKey: {
        type  : 'string',
        format: 'publicKey',
      },
    },
    required  : ['publicKey'],
  },
  getDelegates      : {
    id        : 'delegates.getDelegates',
    type      : 'object',
    properties: {
      orderBy: {
        type: 'string',
        enum: [
          'approval:desc', 'approval:asc',
          'productivity:desc', 'productivity:asc',
          'rank:desc', 'rank:asc',
          'vote:desc', 'vote:asc',
          'address:desc', 'address:asc',
          'username:desc', 'username:asc',
          'publicKey:desc', 'publicKey:asc',
        ],
      },
      limit  : {
        type   : 'integer',
        minimum: 1,
        maximum: constants.activeDelegates,
      },
      offset : {
        type   : 'integer',
        minimum: 0,
      },
    },
  },
  getFee            : {
    id        : 'delegates.getFee',
    type      : 'object',
    properties: {
      height: {
        type   : 'integer',
        minimum: 1,
      },
    },
  },
  getForgedByAccount: {
    id        : 'delegates.getForgedByAccount',
    type      : 'object',
    properties: {
      generatorPublicKey: {
        type  : 'string',
        format: 'publicKey',
      },
      start             : {
        type: 'integer',
      },
      end               : {
        type: 'integer',
      },
    },
    required  : ['generatorPublicKey'],
  },
  addDelegate       : {
    id        : 'delegates.addDelegate',
    type      : 'object',
    properties: {
      secret      : {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      publicKey   : {
        type  : 'string',
        format: 'publicKey',
      },
      secondSecret: {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      username    : {
        type     : 'string',
        format   : 'username',
        minLength: 1,
        maxLength: 20,
      },
    },
    required  : ['secret'],
  },
};
