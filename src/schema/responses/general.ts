import { scope } from '../../helpers/strings';
import { respProps } from '../utils/responses';

const s = scope('responses.general');

// tslint:disable object-literal-sort-keys
// tslint:disable trailing-comma
export default {
  deprecated  : {
    id        : s`deprecated`,
    type      : 'object',
    properties: respProps(),
    example   : {
      success: false,
      error  : 'Method is deprecated'
    }
  },
  success     : {
    id        : s`success`,
    type      : 'object',
    properties: respProps(),
    example   : {
      success: true
    }
  },
  error       : {
    id        : s`error`,
    type      : 'object',
    properties: respProps(),
    example   : {
      success: false,
      error  : 'An error has occured'
    }
  },
  accessDenied: {
    id        : s`accessDenied`,
    type      : 'object',
    properties: respProps(),
    example   : {
      success: false,
      error  : 'Secure API Access Denied'
    }
  }
};
