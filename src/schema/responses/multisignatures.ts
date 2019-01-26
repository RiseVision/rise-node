import { TransactionType } from '../../helpers';
import { scope } from '../../helpers/strings';
import { TransactionExamples } from '../common/examples';
import { MultisigTransaction } from '../common/models';
import {
  address,
  amount,
  multisigLifetime,
  multisigMin,
  publicKey,
  signature,
} from '../common/scalars';
import { respProps, successResp } from '../utils/responses';

const s = scope('responses.multisignatures');

// tslint:disable object-literal-sort-keys
// tslint:disable trailing-comma
export default {
  getAccounts: {
    id        : s`getAccounts`,
    type      : 'object',
    properties: respProps({
      accounts: {
        type : 'array',
        items: {
          type      : 'object',
          properties: {
            address,
            balance         : amount,
            multisignatures : {
              type : 'array',
              items: signature
            },
            multilifetime   : multisigLifetime,
            multimin        : multisigMin,
            multisigaccounts: {
              type : 'array',
              items: {
                type      : 'object',
                properties: {
                  address,
                  publicKey,
                  balance: amount
                }
              }
            }
          }
        }
      }
    }),
    example   : successResp({
      accounts: [
        {
          address         : '6507244540548668920R',
          balance         : '186507978130',
          multisignatures : [
            '12a4afbb3c9cf449d14745a190b874a7e0d44c00c8bd68284a826a4e825b0662b59b48df2f8d8ba5f85b3a68dac35b978962246' +
            '23a86a0d661d669dd9df0ba07',
            'c2e81420ee4d0ad3f2cc78e16375cbd6720dc225d5987c2d1467a69193b45b85d371a515313253ecd58216abdce14a462dd9fce' +
            'cd43a129787b07b958cf99301'
          ],
          multilifetime   : 12,
          multimin        : 2,
          multisigaccounts: [
            {
              address  : '5822762156194763844R',
              publicKey: '7aa47589efa3089969ffa62ea67d05fb89b1772a279ae950c186785768907408',
              balance  : '37301595626'
            },
            {
              address  : '16552458475694562786R',
              publicKey: '215e91ad97c027ae2e0fcfa965ecf3f9af412060a94559b8ff8b7b9c4f73381a',
              balance  : '149206382504'
            }
          ]
        }
      ]
    })
  },
  getPending : {
    id        : s`getPending`,
    type      : 'object',
    properties: respProps({
      lifetime   : multisigLifetime,
      min        : multisigMin,
      max        : multisigMin,
      signed     : { type: 'boolean' },
      transaction: MultisigTransaction
    }),
    example   : respProps({
      lifetime   : 12,
      min        : 2,
      max        : 2,
      signed     : true,
      transaction: TransactionExamples[TransactionType.MULTI]
    })
  }
};
