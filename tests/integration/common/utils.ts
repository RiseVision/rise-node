import { expect } from 'chai';
import * as crypto from 'crypto';
import { dposOffline } from 'dpos-offline';
import * as uuid from 'uuid';
import { ITransaction } from 'dpos-offline/src/trxTypes/BaseTx';
import { Ed, IKeypair } from '../../../src/helpers';
import { publicKey } from '../../../src/types/sanityTypes';
import initializer from './init';
import { ISystemModule, ITransactionsModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { IBaseTransaction, VoteAsset } from '../../../src/logic/transactions';

const delegates = require('../genesisDelegates.json');

export const findDelegateByPkey = (pk: publicKey): {
  secret: string,
  address: string,
  publicKey: string,
  username: string
} => {
  return delegates.filter((d) => d.keypair.publicKey === pk).pop();
};

export const getKeypairByPkey = (pk: publicKey): IKeypair => {
  const d = findDelegateByPkey(pk);
  if (typeof (d) === 'undefined') {
    throw new Error('cannot find delegate for this pk ' + pk);
  }
  const ed = new Ed();
  return ed.makeKeypair(crypto
    .createHash('sha256').update(d.secret, 'utf8')
    .digest());
};

export const confirmTransactions = async (txs: Array<ITransaction<any>>, confirmations: number = 1) => {
  const txModule = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
  await txModule.receiveTransactions(txs, false, false);
  await initializer.rawMineBlocks(confirmations);
  for (const tx of txs) {
    expect(txModule.transactionInPool(tx.id)).is.false; // (`TX ${tx.id} is still in pool :(`);
  }
};
export const createRandomWallet  = (): LiskWallet => {
  return new dposOffline.wallets.LiskLikeWallet(uuid.v4(), 'R');
};

export const createVoteTransaction = async (confirmations: number, from: LiskWallet, to: publicKey, add: boolean): Promise<ITransaction> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const t            = new dposOffline.transactions.VoteTx({
    votes: [`${add ? '+' : '-'}${to}`],
  });
  t.set('amount', 0);
  t.set('fee', systemModule.getFees().fees.vote);
  t.set('timestamp', 0);
  t.set('recipientId', from.address);
  const tx = t.sign(from);
  if (confirmations > 0) {
    await confirmTransactions([tx], confirmations);
  }
  return tx;
};

export const createSendTransaction = async (confirmations: number, amount: number, from: LiskWallet, dest: string): Promise<ITransaction> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const t            = new dposOffline.transactions.SendTx();
  t.set('amount', amount);
  t.set('fee', systemModule.getFees().fees.send);
  t.set('timestamp', 0);
  t.set('recipientId', dest);
  const tx = t.sign(from);
  if (confirmations > 0) {
    await confirmTransactions([tx], confirmations);
  }
  return tx;
};

export const getRandomDelegateWallet = (): LiskWallet => {
  const d = delegates[Math.floor(Math.random() * delegates.length)];
  return new dposOffline.wallets.LiskLikeWallet(d.secret, 'R');
}

export const createRandomAccountWithFunds = async (howMany: number = 1000, recipientWallet: LiskWallet = createRandomWallet()): Promise<{ wallet: LiskWallet, txID: string }> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const senderWallet = getRandomDelegateWallet();
  const t            = new dposOffline.transactions.SendTx();
  t.set('amount', howMany);
  t.set('fee', systemModule.getFees().fees.send);
  t.set('timestamp', 0);
  t.set('recipientId', recipientWallet.address);
  const tx = t.sign(senderWallet);
  await confirmTransactions([tx], 1);
  return {
    txID  : tx.id,
    wallet: recipientWallet,
  };
};
