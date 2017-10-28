// tslint:disable object-literal-sort-keys
export default {
  open             : {
    id        : 'accounts.openAccount',
    type      : 'object',
    properties: {
      secret: {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
    },
    required  : ['secret'],
  },
  getBalance       : {
    id        : 'accounts.getBalance',
    type      : 'object',
    properties: {
      address: {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
    },
    required  : ['address'],
  },
  getPublicKey     : {
    id        : 'accounts.getPublickey',
    type      : 'object',
    properties: {
      address: {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
    },
    required  : ['address'],
  },
  generatePublicKey: {
    id        : 'accounts.generatePublickey',
    type      : 'object',
    properties: {
      secret: {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
    },
    required  : ['secret'],
  },
  getDelegates     : {
    id        : 'accounts.getDelegates',
    type      : 'object',
    properties: {
      address: {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
    },
    required  : ['address'],
  },
  getDelegatesFee  : {
    id        : 'accounts.getDelegatesFee',
    type      : 'object',
    properties: {
      height: {
        type   : 'integer',
        minimum: 1,
      },
    },
  },
  addDelegates     : {
    id        : 'accounts.addDelegates',
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
    },
  },
  getAccount       : {
    id        : 'accounts.getAccount',
    type      : 'object',
    properties: {
      address  : {
        type     : 'string',
        format   : 'address',
        minLength: 1,
        maxLength: 22,
      },
      publicKey: {
        type  : 'string',
        format: 'publicKey',
      },
    },
  },
  top              : {
    id        : 'accounts.top',
    type      : 'object',
    properties: {
      limit : {
        type   : 'integer',
        minimum: 0,
        maximum: 100,
      },
      offset: {
        type   : 'integer',
        minimum: 0,
      },
    },
  },
};
