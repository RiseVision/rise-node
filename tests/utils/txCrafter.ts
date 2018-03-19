import { dposOffline } from 'dpos-offline';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { ITransaction } from 'dpos-offline/src/trxTypes/BaseTx';
import { generateAccount } from './accountsUtils';

export const createRandomTransactions = (config: { send?: number, vote?: number } = {}): Array<ITransaction> => {
  const send = config.send || 0;
  const vote = config.vote || 0;

  const toRet = [];
  for (let i = 0; i < send; i++) {
    toRet.push(createSendTransaction(generateAccount(), generateAccount().address, 1, { amount: i + 1000 }));
  }
  for (let i = 0; i < vote; i++) {
    toRet.push(createVoteTransaction(generateAccount(), 1, { assets: { vote: ['+a'] } }));
  }
  return toRet;
};

export const createSendTransaction = (from: LiskWallet, recipient: string, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.SendTx()
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return t
    .withFees(fee)
    .withRecipientId(recipient)
    .sign(from);
};

export const createVoteTransaction = (from: LiskWallet, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.VoteTx(obj.asset)
    .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return t.withFees(fee).sign(from);
};

export const createRegDelegateTX = (from: LiskWallet, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.DelegateTx(obj.asset)
    // .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return t.withFees(fee).sign(from);
};

export const create2ndSigTX = (from: LiskWallet, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.CreateSignatureTx(obj.asset)
    // .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return t.withFees(fee).sign(from);
};
