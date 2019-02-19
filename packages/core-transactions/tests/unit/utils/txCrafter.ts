import { IBaseTransaction } from '@risevision/core-types';
import { Address, IKeypair, RiseV2, RiseV2Transaction } from 'dpos-offline';
import * as uuid from 'uuid';

export const createRandomTransaction = (
  wallet = RiseV2.deriveKeypair(uuid.v4())
): RiseV2Transaction<any> => {
  return createSendTransaction(
    wallet,
    RiseV2.calcAddress(RiseV2.deriveKeypair(uuid.v4()).publicKey),
    10000000,
    { amount: Date.now() % 100000 }
  );
};
export const createRandomTransactions = (
  howMany: number
): Array<RiseV2Transaction<any>> => {
  return new Array(howMany).fill(null).map(() => createRandomTransaction());
};

export const createSendTransaction = (
  from: IKeypair,
  recipient: Address,
  fee: number | bigint,
  obj: any = {}
): RiseV2Transaction<null> => {
  const t: RiseV2Transaction<any> = {
    asset: null,
    fee: parseInt(`${fee}`, 10),
    recipientId: recipient,
    senderId: RiseV2.calcAddress(from.publicKey),
    timestamp: 0,
    type: 10,
    version: 0,
    ...obj,
  };

  return RiseV2.txs.sign(t, from);
};

//
export const toNativeTx = <T = any>(
  tx: RiseV2Transaction<any>
): IBaseTransaction<T, bigint> & { senderId: string } => {
  return {
    ...tx,
    amount: BigInt(tx.amount),
    fee: BigInt(tx.fee),
  };
};
