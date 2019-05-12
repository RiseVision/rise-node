import { scope } from '../../helpers/strings';
import { height, hex, wholeNum } from '../common/scalars';
import { respProps, successResp } from '../utils/responses';

const s = scope('responses.loader');

// tslint:disable object-literal-sort-keys
// tslint:disable trailing-comma
export default {
  getStatus    : {
    id        : s`getStatus`,
    type      : 'object',
    properties: respProps({
      loaded: { type: 'boolean' }
    }),
    example   : successResp({
      loaded: true
    })
  },
  getStatusSync: {
    id        : s`getStatusSync`,
    type      : 'object',
    properties: respProps({
      broadhash: hex,
      consensus: wholeNum,
      height,
      syncing  : { type: 'boolean' }
    }),
    example   : successResp({
      broadhash: 'fa4a803eaf159154de7c4311580debb068ffd178a03dd793c4799fb04a3997bd',
      consensus: 97,
      height   : 1356891,
      syncing  : false
    })
  },
  ping         : {
    id        : s`ping`,
    type      : 'object',
    properties: respProps(),
    example   : successResp()
  }
};
