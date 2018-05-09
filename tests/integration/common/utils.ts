import { expect } from 'chai';
import * as crypto from 'crypto';
import { dposOffline } from 'dpos-offline';
import * as uuid from 'uuid';
import { ITransaction } from 'dpos-offline/src/trxTypes/BaseTx';
import { Ed, IKeypair } from '../../../src/helpers';
import { publicKey } from '../../../src/types/sanityTypes';
import initializer from './init';
import {
  IAccountsModule,
  IBlocksModule,
  IMultisignaturesModule,
  ISystemModule,
  ITransactionsModule
} from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import * as txCrafter from '../../utils/txCrafter';
import { toBufferedTransaction } from '../../utils/txCrafter';

const delegates    = require('../genesisDelegates.json');
const genesisBlock = require('../genesisBlock.json');

export const findDelegateByPkey = (pk: publicKey): {
  secret: string,
  address: string,
  publicKey: string,
  username: string
} => {
  const del    = delegates.filter((d) => d.keypair.publicKey === pk)[0];
  del.username = genesisBlock
    .transactions
    .filter((t) => t.type === 2)
    .filter((t) => t.senderPublicKey.toString('hex') === pk)
    .map((t) => t.asset.delegate.username)[0];

  return del;
};

export const findDelegateByUsername = (username: string) => {
  const tx = genesisBlock.transactions.filter((t) => t.type === 2)
    .filter((t) => {
      return t.asset.delegate.username.toLowerCase() === username.toLowerCase()
    })[0];

  return findDelegateByPkey(tx.senderPublicKey.toString('hex'));
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

export const confirmTransactions = async (txs: Array<ITransaction<any>>, withTxPool: boolean) => {
  txs = txs.slice();
  if (withTxPool) {
    const txModule = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
    try {
     await txModule.receiveTransactions(txs.map((t) => toBufferedTransaction(t)), false, false);
    } catch (e) {
      console.warn('receive tx err', e);
    }
    await initializer.rawMineBlocks(Math.ceil(txs.length / 25));
    for (const tx of txs) {
     expect(txModule.transactionInPool(tx.id)).is.false; // (`TX ${tx.id} is still in pool :(`);
    }
    return;
  } else {
    while (txs.length > 0) {
      await initializer.rawMineBlockWithTxs(txs.splice(0, 25).map((t) => toBufferedTransaction(t)));
    }
  }
};
export const createRandomWallet  = (): LiskWallet => {
  return new dposOffline.wallets.LiskLikeWallet(uuid.v4(), 'R');
};

export const createVoteTransaction = async (confirmations: number, from: LiskWallet, to: publicKey, add: boolean, obj: any = {}): Promise<ITransaction> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const tx           = txCrafter.createVoteTransaction(from, systemModule.getFees().fees.vote, {
    ... {
      asset: {
        votes: [`${add ? '+' : '-'}${to}`],
      },
    },
    ...obj,
  });
  tx['senderId']     = initializer.appManager.container.get<IAccountsModule>(Symbols.modules.accounts)
    .generateAddressByPublicKey(tx.senderPublicKey);
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const createSecondSignTransaction = async (confirmations: number, from: LiskWallet, pk: publicKey) => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const tx           = txCrafter.create2ndSigTX(
    from,
    systemModule.getFees().fees.secondsignature,
    {
      asset: {
        signature: {
          publicKey: pk,
        },
      },
    });
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};
export const easyCreateMultiSignAccount  = async (howMany: number, min: number = howMany) => {
  const {wallet} = await createRandomAccountWithFunds(Math.pow(10, 11));
  const keys     = new Array(howMany).fill(null).map(() => createRandomWallet());
  return createMultiSignAccount(wallet, keys, min);
}

export const createMultiSignAccount = async (wallet: LiskWallet, keys: LiskWallet[], min: number, extra: any = {}) => {
  const {tx, signatures} = createMultiSignTransactionWithSignatures(
    wallet,
    min,
    keys,
    24,
    extra
  );

  const txModule       = initializer.appManager.container
    .get<ITransactionsModule>(Symbols.modules.transactions);
  const multisigModule = initializer.appManager.container
    .get<IMultisignaturesModule>(Symbols.modules.multisignatures);

  await txModule.receiveTransactions([toBufferedTransaction(tx)], false, false);
  // We should ask multisignature module to change readyness state of such tx.

  for (const signature of signatures) {
    await multisigModule.processSignature({signature, transaction: tx.id});
  }
  await initializer.rawMineBlocks(1);
  return {wallet, keys, tx};
};

export const createMultiSignTransactionWithSignatures = (from: LiskWallet, min: number, keys: LiskWallet[], lifetime: number = 24, extra: any) => {
  const tx         = createMultiSignTransaction(from, min, keys.map((k) => `+${k.publicKey}`), lifetime, extra);
  const signatures = keys.map((k) => k.getSignatureOfTransaction(tx));
  return {tx, signatures};
};

export const createMultiSignTransaction = (from: LiskWallet, min: number, keysgroup: publicKey[], lifetime: number = 24, extra: any = {}) => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const tx           = txCrafter.createMultiSigTX(
    from,
    systemModule.getFees().fees.secondsignature,
    {
      ... {
        asset: {
          multisignature: {
            keysgroup,
            lifetime,
            min,
          },
        },
      },
      ...extra
    }
  );
  tx['senderId']     = initializer.appManager.container.get<IAccountsModule>(Symbols.modules.accounts)
    .generateAddressByPublicKey(tx.senderPublicKey);
  return tx;
};

export const createRegDelegateTransaction = async (confirmations: number, from: LiskWallet, name: string, obj: any = {}): Promise<ITransaction> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const tx           = txCrafter.createRegDelegateTX(from, systemModule.getFees().fees.delegate, {
    ... {
      asset: {
        delegate: {
          username : name,
          publicKey: from.publicKey
        },
      },
    },
    ...obj,
  });
  tx['senderId']     = initializer.appManager.container.get<IAccountsModule>(Symbols.modules.accounts)
    .generateAddressByPublicKey(tx.senderPublicKey);
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const createSendTransaction = async (confirmations: number, amount: number, from: LiskWallet, dest: string, opts: any = {}): Promise<ITransaction> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const tx           = txCrafter.createSendTransaction(from, dest, systemModule.getFees().fees.send, {...{amount}, ...opts});
  tx['senderId']     = initializer.appManager.container.get<IAccountsModule>(Symbols.modules.accounts)
    .generateAddressByPublicKey(tx.senderPublicKey);
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const getRandomDelegateWallet = (): LiskWallet => {
  const d = delegates[Math.floor(Math.random() * delegates.length)];
  return new dposOffline.wallets.LiskLikeWallet(d.secret, 'R');
}

export const createRandomAccountWithFunds = async (howMany: number = 1000, recipientWallet: LiskWallet = createRandomWallet()) => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const senderWallet = getRandomDelegateWallet();
  const t            = new dposOffline.transactions.SendTx();
  t.set('amount', howMany);
  t.set('fee', systemModule.getFees().fees.send);
  t.set('timestamp', 0);
  t.set('recipientId', recipientWallet.address);
  const tx = t.sign(senderWallet);
  await confirmTransactions([tx], true);
  return {
    delegate: senderWallet,
    txID    : tx.id,
    wallet  : recipientWallet,
  };
};

export const createRandomAccountsWithFunds = async (howManyAccounts: number, amount: number): Promise<Array<{ tx: ITransaction, account: LiskWallet, senderWallet: LiskWallet }>> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
  const senderWallet = getRandomDelegateWallet();

  const txs                    = [];
  const accounts: LiskWallet[] = [];
  for (let i = 0; i < howManyAccounts; i++) {
    const randomRecipient = createRandomWallet();
    const t               = new dposOffline.transactions.SendTx();
    t.set('amount', amount);
    t.set('fee', systemModule.getFees().fees.send);
    t.set('timestamp', 0);
    t.set('recipientId', randomRecipient.address);
    const signedTx = t.sign(senderWallet);
    signedTx['senderId'] = senderWallet.address;
    txs.push(signedTx);
    accounts.push(randomRecipient);
  }

  await confirmTransactions(txs, false);
  return txs
    .map((tx, idx) => ({tx, account: accounts[idx], senderWallet}));
};
