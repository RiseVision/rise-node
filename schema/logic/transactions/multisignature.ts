import constants from '../../../helpers/constants';
// tslint:disable object-literal-sort-keys

export default {
  id        : 'Multisignature',
  type      : 'object',
  properties: {
    min      : {
      type   : 'integer',
      minimum: constants.multisigConstraints.min.minimum,
      maximum: constants.multisigConstraints.min.maximum,
    },
    keysgroup: {
      type    : 'array',
      minItems: constants.multisigConstraints.keysgroup.minItems,
      maxItems: constants.multisigConstraints.keysgroup.maxItems,
    },
    lifetime : {
      type   : 'integer',
      minimum: constants.multisigConstraints.lifetime.minimum,
      maximum: constants.multisigConstraints.lifetime.maximum,
    },
  },
  required  : ['min', 'keysgroup', 'lifetime'],
};
