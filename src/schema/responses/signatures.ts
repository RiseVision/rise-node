import { scope } from '../../helpers/strings';
import { feeHeight } from '../common/fragments';
import { amount } from '../common/scalars';
import { respProps, successResp } from '../utils/responses';

const s = scope('responses.signatures');

// tslint:disable object-literal-sort-keys
// tslint:disable trailing-comma
export default {
  fees: {
    id        : s`fees`,
    type      : 'object',
    properties: respProps({
      ...feeHeight,
      fee: amount
    }),
    example   : successResp({
      fromHeight: 1,
      height    : 1362861,
      toHeight  : null,
      fee       : 500000000
    })
  }
};
