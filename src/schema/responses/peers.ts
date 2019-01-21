import { scope } from '../../helpers/strings';
import { PeerExamples } from '../common/examples';
import { Peer } from '../common/models';
import { version, wholeNum } from '../common/scalars';
import { respProps, successResp } from '../utils/responses';

const s = scope('responses.peers');

// tslint:disable object-literal-sort-keys
// tslint:disable trailing-comma
export default {
  getPeers: {
    id        : s`getPeers`,
    type      : 'object',
    properties: respProps({
      peers: {
        type : 'array',
        items: Peer
      }
    }),
    example   : successResp({
      peers: PeerExamples
    })
  },
  getPeer : {
    id        : s`getPeer`,
    type      : 'object',
    properties: respProps({
      peer: Peer
    }),
    example   : successResp({
      peer: PeerExamples[0]
    })
  },
  version : {
    id        : s`version`,
    type      : 'object',
    properties: respProps({
      build     : { type: 'string' },
      minVersion: { type: 'string' },
      version
    }),
    example   : successResp({
      build     : '',
      minVersion: '>=0.1.2',
      version   : '1.1.1'
    })
  },
  count   : {
    id        : s`count`,
    type      : 'object',
    properties: respProps({
      connected   : wholeNum,
      disconnected: wholeNum,
      banned      : wholeNum
    }),
    example   : successResp({
      connected   : 107,
      disconnected: 0,
      banned      : 0
    })
  }
};
