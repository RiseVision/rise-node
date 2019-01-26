import { scope } from '../../helpers/strings';
import { DelegateExamples, publicKeyExamples } from '../common/examples';
import { Block, Delegate } from '../common/models';
import {
  address,
  amount,
  height,
  publicKey,
  stringnum,
  username,
  wholeNum,
} from '../common/scalars';
import { respProps, successResp } from '../utils/responses';

const s = scope('responses.delegates');

// tslint:disable object-literal-sort-keys
// tslint:disable trailing-comma
export default {
  getDelegates      : {
    id        : s`getDelegates`,
    type      : 'object',
    properties: respProps({
      delegates : {
        type : 'array',
        items: Delegate
      },
      totalCount: wholeNum
    }),
    example   : successResp({
      delegates : DelegateExamples,
      totalCount: 893
    })
  },
  getFee            : {
    id        : s`getFee`,
    type      : 'object',
    properties: respProps({
      fee       : amount,
      fromHeight: height,
      toHeight  : height,
      height
    }),
    example   : successResp({
      fromHeight: 1,
      height    : 1356762,
      toHeight  : null,
      fee       : 2500000000
    })
  },
  getForgedByAccount: {
    id        : s`getForgedByAccount`,
    type      : 'object',
    properties: respProps({
      fees   : amount,
      forged : stringnum,
      rewards: amount
    }),
    example   : successResp({
      fees   : 81373069039,
      forged : '17052373069039',
      rewards: 16971000000000
    })
  },
  getDelegate       : {
    id        : s`getDelegate`,
    type      : 'object',
    properties: respProps({
      delegate: Delegate
    }),
    example   : successResp({
      delegate: DelegateExamples[0]
    })
  },
  getVoters         : {
    id        : s`getVoters`,
    type      : 'object',
    properties: respProps({
      accounts: {
        type : 'array',
        items: {
          type      : 'object',
          properties: {
            address,
            balance: amount,
            username,
            publicKey
          }
        }
      }
    }),
    example   : successResp({
      accounts: [
        {
          address  : '9255027573703699506R',
          balance  : 10,
          username : 'coolguy',
          publicKey: '248fe3d613f5f110bd12ac55c90f8bd8e3a018c15dee6c0fdaf4dd6b711a670f'
        },
        {
          address  : '6515902227625427085R',
          balance  : 0,
          username : null,
          publicKey: '597ffe0c6bdc5a9ef4c0eed6377326f173059af24fd049df63b339bc22a9f928'
        },
        {
          address  : '10101597481712370665R',
          balance  : 12,
          username : null,
          publicKey: '6703661ecd198003366a20c7308c5eafcf85377949af970e375486093938e01a'
        }
      ]
    })
  },
  search            : {
    id        : s`search`,
    type      : 'object',
    properties: respProps({
      delegates: {
        type : 'array',
        items: Delegate
      }
    }),
    example   : successResp({
      delegates: [DelegateExamples[0], DelegateExamples[2]]
    })
  },
  count             : {
    id        : s`count`,
    type      : 'object',
    properties: respProps({
      count: wholeNum
    }),
    example   : successResp({
      count: 5237
    })
  },
  getNextForgers    : {
    id        : s`getNextForgers`,
    type      : 'object',
    properties: respProps({
      currentBlock    : Block,
      currentBlockSlot: wholeNum,
      currentSlot     : wholeNum,
      delegates       : {
        type : 'array',
        items: publicKey
      }
    }),
    example   : successResp({
      currentBlock    : {
        id                  : '7608930088168657394',
        blockSignature      : '058b9e59e6db9a68576faea657dd0971c1dfe86b6f3cfec796481a1e815ecbb559e1026ece9b0daac3a2' +
        '4579311af548edb47632f3ed76effe0fd5c8a6743905',
        generatorPublicKey  : '37831fe92d110d1279b02528ca95d89bcfd486ddf465660924eb2e103acd964d',
        height              : 1356718,
        numberOfTransactions: 0,
        payloadHash         : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        payloadLength       : 0,
        previousBlock       : '4446098730403296147',
        reward              : 1200000000,
        timestamp           : 74389770,
        totalAmount         : 0,
        totalFee            : 0,
        version             : 0,
        transactions        : []
      },
      currentBlockSlot: 2479659,
      currentSlot     : 2479659,
      delegates       : publicKeyExamples
    })
  },
  getForgingStatus  : {
    id        : s`getForgingStatus`,
    type      : 'object',
    properties: respProps({
      enabled  : { type: 'boolean' },
      delegates: {
        type : 'array',
        items: publicKey
      }
    }),
    example   : successResp({
      enabled  : true,
      delegates: publicKeyExamples
    })
  },
  forgingEnable     : {
    id        : s`forgingEnable`,
    type      : 'object',
    properties: respProps(),
    example   : successResp()
  },
  forgingDisable    : {
    id        : s`forgingDisable`,
    type      : 'object',
    properties: respProps(),
    example   : successResp()
  },
  accessDenied      : {
    id        : s`accessDenied`,
    type      : 'object',
    properties: respProps(),
    example   : {
      success: false,
      error  : 'Delegates API Access Denied'
    }
  }
};
