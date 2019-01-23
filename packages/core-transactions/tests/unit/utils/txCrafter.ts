import { IBaseTransaction } from '@risevision/core-types';
import { Address, IKeypair, RiseTransaction, RiseV2 } from 'dpos-offline';
import * as uuid from 'uuid';
// import { generateAccount } from './accountsUtils';

export const createRandomTransaction = (
  wallet = RiseV2.deriveKeypair(uuid.v4())
): RiseTransaction<any> => {
  return createSendTransaction(
    wallet,
    RiseV2.calcAddress(RiseV2.deriveKeypair(uuid.v4()).publicKey),
    10000000,
    { amount: Date.now() % 100000 }
  );
};
export const createRandomTransactions = (
  howMany: number
): Array<RiseTransaction<any>> => {
  return new Array(howMany).fill(null).map(() => createRandomTransaction());
};

export const createSendTransaction = (
  from: IKeypair,
  recipient: Address,
  fee: number | bigint,
  obj: any = {}
): RiseTransaction<null> => {
  const t: RiseTransaction<any> = {
    asset: null,
    fee: parseInt(`${fee}`, 10),
    recipientId: recipient,
    senderId: RiseV2.calcAddress(from.publicKey),
    senderPublicKey: from.publicKey,
    timestamp: 0,
    type: 0,
    ...obj,
  };

  t.signature = RiseV2.txs.calcSignature(t, from);
  t.id = RiseV2.txs.identifier(t);
  return t;
};

//

//

export const toNativeTx = <T = any>(
  tx: RiseTransaction<any>
): IBaseTransaction<T, bigint> & { senderId: string } => {
  const toRet = {
    ...tx,
    amount: BigInt(tx.amount),
    fee: BigInt(tx.fee),
    senderPubData: tx.senderPublicKey,
    signatures: [tx.signature],
    version: (tx as any).version || 0,
  };
  delete toRet.signature;
  delete toRet.senderPublicKey;
  return toRet;
};
