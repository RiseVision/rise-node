import { Address, IKeypair } from '@risevision/core-types';
import { RiseV2Transaction } from 'dpos-offline';
import { createRandomTransaction } from '../../../core-transactions/tests/unit/utils/txCrafter';
import { KeyStoreAsset } from '../../src';

export const createKeystoreTransaction = (
  acc: IKeypair & { address: Address },
  key: string,
  value: Buffer,
  opts: { fee: bigint; timestamp: number; type: number } = {
    fee: 1n,
    timestamp: 0,
    type: 100,
  }
): RiseV2Transaction<KeyStoreAsset> => {
  return null; // TODO:
  // return {
  //   amount: '0',
  //   asset: { key, value },
  //   fee: `${opts.fee}`,
  //   timestamp: opts.timestamp,
  //   senderId: acc.address,
  //   senderPubData: acc.publicKey,
  //   type: opts.type,
  //   recipientId: null,
  //   version: 1,
  // };
};
