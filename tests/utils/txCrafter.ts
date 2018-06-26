import { dposOffline } from 'dpos-offline';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { ITransaction } from 'dpos-offline/src/trxTypes/BaseTx';
import { generateAccount } from './accountsUtils';
import { IBaseTransaction } from '../../src/logic/transactions';

export const toBufferedTransaction    = <T>(t: ITransaction<any>): IBaseTransaction<T> => {
  return {
    ...t, ... {
      requesterPublicKey: t.requesterPublicKey === null || typeof(t.requesterPublicKey) === 'undefined' ?
        null :
        Buffer.from(t.requesterPublicKey, 'hex'),
      senderPublicKey   : Buffer.from(t.senderPublicKey, 'hex'),
      signSignature     : t.signSignature === null || typeof(t.signSignature) === 'undefined' ?
        null :
        Buffer.from(t.signSignature, 'hex'),
      signature         : Buffer.from(t.signature, 'hex'),
    }
  }
}
export const createRandomTransactions = (config: { send?: number, vote?: number, signature?: number, delegate?: number } = {}): Array<ITransaction> => {
  const send      = config.send || 0;
  const vote      = config.vote || 0;
  const signature = config.signature || 0;
  const delegate  = config.delegate || 0;

  const toRet = [];
  for (let i = 0; i < send; i++) {
    toRet.push(createSendTransaction(generateAccount(), generateAccount().address, 1, { amount: i + 1000 }));
  }
  for (let i = 0; i < vote; i++) {
    toRet.push(createVoteTransaction(generateAccount(), 1, { asset: { votes: [`+${generateAccount().publicKey}`] } }));
  }
  for (let i = 0; i < signature; i++) {
    toRet.push(create2ndSigTX(generateAccount(), 1, { asset: { signature: { publicKey: generateAccount().publicKey } } }));
  }
  for (let i = 0; i < delegate; i++) {
    toRet.push(createRegDelegateTX(generateAccount(), 1, { asset: { delegate: { username: `del${i}_${generateAccount().publicKey.substr(0, 4) }` } } }));
  }
  return toRet;
};

export const createSendTransaction = (from: LiskWallet, recipient: string, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.SendTx()
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return from.signTransaction(
    t
    .withFees(fee)
    .withRecipientId(recipient)
  );
};

export const createVoteTransaction = (from: LiskWallet, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.VoteTx(obj.asset)
    .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return from.signTransaction(t.withFees(fee));
};

export const createRegDelegateTX = (from: LiskWallet, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.DelegateTx(obj.asset)
  // .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return from.signTransaction(t.withFees(fee));
};

export const create2ndSigTX = (from: LiskWallet, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.CreateSignatureTx(obj.asset)
  // .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return from.signTransaction(t.withFees(fee));
};

export const createMultiSigTX = (from: LiskWallet, fee: number, obj: any = {}): ITransaction => {
  const t = new dposOffline.transactions.MultiSignatureTx(obj.asset)
  // .withRecipientId(from.address)
    .withTimestamp(0);
  Object.keys(obj).forEach((k) => t.set(k as any, obj[k]));
  return from.signTransaction(t.withFees(fee));
};
