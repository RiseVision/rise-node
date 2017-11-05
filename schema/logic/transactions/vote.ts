// tslint:disable object-literal-sort-keys
import constants from '../../../helpers/constants';

export default {
  id                  : 'Vote',
  type                : 'object',
  properties          : {
    votes: {
      type       : 'array',
      minItems   : 1,
      maxItems   : constants.maxVotesPerTransaction,
      uniqueItems: true,
      items      : {
        type   : 'string',
        pattern: '^[-+]{1}[0-9a-z]{64}$',
      },
    },
  },
  required            : ['votes'],
  additionalProperties: false,
};
