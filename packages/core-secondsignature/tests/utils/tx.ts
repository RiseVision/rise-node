import { dposOffline, LiskWallet } from 'dpos-offline';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';

export const create2ndSigTX = (
  from: LiskWallet,
  fee: number,
  obj: any = {}
): ITransaction => {
  const t = new dposOffline.transactions.CreateSignatureTx(obj.asset)
    // .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return from.signTransaction(t.withFees(fee));
};
