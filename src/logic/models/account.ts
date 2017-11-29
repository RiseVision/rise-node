import {constants} from '../../helpers/';
import {IModelField} from './modelField';
// tslint:disable
/**
 * @typedef {Object} account
 * @property {string} username - Lowercase, between 1 and 20 chars.
 * @property {boolean} isDelegate
 * @property {boolean} u_isDelegate
 * @property {boolean} secondSignature
 * @property {boolean} u_secondSignature
 * @property {string} u_username
 * @property {address} address - Uppercase, between 1 and 22 chars.
 * @property {publicKey} publicKey
 * @property {publicKey} secondPublicKey
 * @property {number} balance - Between 0 and totalAmount from constants.
 * @property {number} u_balance - Between 0 and totalAmount from constants.
 * @property {number} vote
 * @property {number} rate
 * @property {String[]} delegates - From mem_account2delegates table, filtered by address.
 * @property {String[]} u_delegates - From mem_account2u_delegates table, filtered by address.
 * @property {String[]} multisignatures - From mem_account2multisignatures table, filtered by address.
 * @property {String[]} u_multisignatures - From mem_account2u_multisignatures table, filtered by address.
 * @property {number} multimin - Between 0 and 17.
 * @property {number} u_multimin - Between 0 and 17.
 * @property {number} multilifetime - Between 1 and 72.
 * @property {number} u_multilifetime - Between 1 and 72.
 * @property {string} blockId
 * @property {boolean} nameexist
 * @property {boolean} u_nameexist
 * @property {number} producedblocks - Between -1 and 1.
 * @property {number} missedblocks - Between -1 and 1.
 * @property {number} fees
 * @property {number} rewards
 * @property {boolean} virgin
 */
export const accountsModelCreator = (table:string): IModelField[] =>  [
  {
    name     : 'username',
    type     : 'String',
    filter   : {
      type     : 'string',
      case     : 'lower',
      maxLength: 20,
      minLength: 1
    },
    conv     : String,
    immutable: true
  },
  {
    name  : 'isDelegate',
    type  : 'SmallInt',
    filter: {
      type: 'boolean'
    },
    conv  : Boolean
  },
  {
    name  : 'u_isDelegate',
    type  : 'SmallInt',
    filter: {
      type: 'boolean'
    },
    conv  : Boolean
  },
  {
    name  : 'secondSignature',
    type  : 'SmallInt',
    filter: {
      type: 'boolean'
    },
    conv  : Boolean
  },
  {
    name  : 'u_secondSignature',
    type  : 'SmallInt',
    filter: {
      type: 'boolean'
    },
    conv  : Boolean
  },
  {
    name     : 'u_username',
    type     : 'String',
    filter   : {
      type     : 'string',
      case     : 'lower',
      maxLength: 20,
      minLength: 1
    },
    conv     : String,
    immutable: true
  },
  {
    name      : 'address',
    type      : 'String',
    filter    : {
      required : true,
      type     : 'string',
      case     : 'upper',
      minLength: 1,
      maxLength: 22
    },
    conv      : String,
    immutable : true,
    expression: 'UPPER("address")'
  },
  {
    name      : 'publicKey',
    type      : 'Binary',
    filter    : {
      type  : 'string',
      format: 'publicKey'
    },
    conv      : String,
    immutable : true,
    expression: 'ENCODE("publicKey", \'hex\')'
  },
  {
    name      : 'secondPublicKey',
    type      : 'Binary',
    filter    : {
      type  : 'string',
      format: 'publicKey'
    },
    conv      : String,
    immutable : true,
    expression: 'ENCODE("secondPublicKey", \'hex\')'
  },
  {
    name      : 'balance',
    type      : 'BigInt',
    filter    : {
      required: true,
      type    : 'integer',
      minimum : 0,
      maximum : constants.totalAmount
    },
    conv      : Number,
    expression: '("balance")::bigint'
  },
  {
    name      : 'u_balance',
    type      : 'BigInt',
    filter    : {
      required: true,
      type    : 'integer',
      minimum : 0,
      maximum : constants.totalAmount
    },
    conv      : Number,
    expression: '("u_balance")::bigint'
  },
  {
    name      : 'vote',
    type      : 'BigInt',
    filter    : {
      type: 'integer'
    },
    conv      : Number,
    expression: '("vote")::bigint'
  },
  {
    name      : 'rate',
    type      : 'BigInt',
    filter    : {
      type: 'integer'
    },
    conv      : Number,
    expression: '("rate")::bigint'
  },
  {
    name      : 'delegates',
    type      : 'Text',
    filter    : {
      type       : 'array',
      uniqueItems: true
    },
    conv      : Array,
    expression: '(SELECT ARRAY_AGG("dependentId") FROM '+ table + '2delegates WHERE "accountId" = a."address")'
  },
  {
    name      : 'u_delegates',
    type      : 'Text',
    filter    : {
      type       : 'array',
      uniqueItems: true
    },
    conv      : Array,
    expression: '(SELECT ARRAY_AGG("dependentId") FROM '+ table + '2u_delegates WHERE "accountId" = a."address")'
  },
  {
    name      : 'multisignatures',
    type      : 'Text',
    filter    : {
      type       : 'array',
      uniqueItems: true
    },
    conv      : Array,
    expression: '(SELECT ARRAY_AGG("dependentId") FROM '+ table + '2multisignatures WHERE "accountId" = a."address")'
  },
  {
    name      : 'u_multisignatures',
    type      : 'Text',
    filter    : {
      type       : 'array',
      uniqueItems: true
    },
    conv      : Array,
    expression: '(SELECT ARRAY_AGG("dependentId") FROM '+ table + '2u_multisignatures WHERE "accountId" = a."address")'
  },
  {
    name  : 'multimin',
    type  : 'SmallInt',
    filter: {
      type   : 'integer',
      minimum: 0,
      maximum: 17
    },
    conv  : Number
  },
  {
    name  : 'u_multimin',
    type  : 'SmallInt',
    filter: {
      type   : 'integer',
      minimum: 0,
      maximum: 17
    },
    conv  : Number
  },
  {
    name  : 'multilifetime',
    type  : 'SmallInt',
    filter: {
      type   : 'integer',
      minimum: 1,
      maximum: 72
    },
    conv  : Number
  },
  {
    name  : 'u_multilifetime',
    type  : 'SmallInt',
    filter: {
      type   : 'integer',
      minimum: 1,
      maximum: 72
    },
    conv  : Number
  },
  {
    name  : 'blockId',
    type  : 'String',
    filter: {
      type     : 'string',
      minLength: 1,
      maxLength: 20
    },
    conv  : String
  },
  {
    name  : 'nameexist',
    type  : 'SmallInt',
    filter: {
      type: 'boolean'
    },
    conv  : Boolean
  },
  {
    name  : 'u_nameexist',
    type  : 'SmallInt',
    filter: {
      type: 'boolean'
    },
    conv  : Boolean
  },
  {
    name  : 'producedblocks',
    type  : 'Number',
    filter: {
      type   : 'integer',
      minimum: -1,
      maximum: 1
    },
    conv  : Number
  },
  {
    name  : 'missedblocks',
    type  : 'Number',
    filter: {
      type   : 'integer',
      minimum: -1,
      maximum: 1
    },
    conv  : Number
  },
  {
    name      : 'fees',
    type      : 'BigInt',
    filter    : {
      type: 'integer'
    },
    conv      : Number,
    expression: '("fees")::bigint'
  },
  {
    name      : 'rewards',
    type      : 'BigInt',
    filter    : {
      type: 'integer'
    },
    conv      : Number,
    expression: '("rewards")::bigint'
  },
  {
    name     : 'virgin',
    type     : 'SmallInt',
    filter   : {
      type: 'boolean'
    },
    conv     : Boolean,
    immutable: true
  }
];
