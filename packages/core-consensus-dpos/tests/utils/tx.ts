import { dposOffline, LiskWallet } from 'dpos-offline';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';

export const createVoteTransaction = (
  from: LiskWallet,
  fee: number,
  obj: any = {}
): ITransaction => {
  const t = new dposOffline.transactions.VoteTx(obj.asset)
    .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return from.signTransaction(t.withFees(fee));
};

export const createRegDelegateTX = (
  from: LiskWallet,
  fee: number,
  obj: any = {}
): ITransaction => {
  const t = new dposOffline.transactions.DelegateTx(obj.asset)
    // .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return from.signTransaction(t.withFees(fee));
};
