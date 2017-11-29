// tslint:disable object-literal-sort-keys
export default {
  id        : 'DApp',
  object    : true,
  type      : 'object',
  properties: {
    category   : {
      type   : 'integer',
      minimum: 0,
      maximum: 8,
    },
    name       : {
      type     : 'string',
      minLength: 1,
      maxLength: 32,
    },
    description: {
      type     : 'string',
      minLength: 0,
      maxLength: 160,
    },
    tags       : {
      type     : 'string',
      minLength: 0,
      maxLength: 160,
    },
    type       : {
      type   : 'integer',
      minimum: 0,
    },
    link       : {
      type     : 'string',
      minLength: 0,
      maxLength: 2000,
    },
    icon       : {
      type     : 'string',
      minLength: 0,
      maxLength: 2000,
    },
  },
  required  : ['type', 'name', 'category'],
};
