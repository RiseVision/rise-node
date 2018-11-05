import * as dposTXCrafter from '@risevision/core-consensus-dpos/tests/utils/tx';
import { Crypto } from '@risevision/core-crypto';
import {
  IAccountsModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import {
  MultisignaturesModule,
  MultisigSymbols,
} from '@risevision/core-multisignature';
import * as multiTXCrafter from '@risevision/core-multisignature/tests/utils/tx';
import { p2pSymbols, Peer } from '@risevision/core-p2p';
import * as secondTXCrafter from '@risevision/core-secondsignature/tests/utils/tx';
import {
  PoolManager,
  PostTransactionsRequest,
  TransactionPool,
  TXSymbols,
} from '@risevision/core-transactions';
import * as txCrafter from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { toBufferedTransaction } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { ConstantsType, IKeypair, publicKey } from '@risevision/core-types';
import { expect } from 'chai';
import * as crypto from 'crypto';
import { dposOffline } from 'dpos-offline';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { ITransaction } from 'dpos-offline/src/trxTypes/BaseTx';
import * as uuid from 'uuid';
import initializer from './init';
import { BlocksModule, BlocksSymbols } from '@risevision/core-blocks';

const delegates = require('../../../../core-launchpad/tests/unit/assets/genesisDelegates.json');
const genesisBlock = require('../../../../core-launchpad/tests/unit/assets/genesisBlock.json');

export const findDelegateByPkey = (
  pk: publicKey
): {
  secret: string;
  address: string;
  publicKey: string;
  username: string;
} => {
  const del = delegates.filter((d) => d.keypair.publicKey === pk)[0];
  del.username = genesisBlock.transactions
    .filter((t) => t.type === 2)
    .filter((t) => t.senderPublicKey.toString('hex') === pk)
    .map((t) => t.asset.delegate.username)[0];

  return del;
};

export const findDelegateByUsername = (username: string) => {
  const tx = genesisBlock.transactions
    .filter((t) => t.type === 2)
    .filter((t) => {
      return t.asset.delegate.username.toLowerCase() === username.toLowerCase();
    })[0];

  return findDelegateByPkey(tx.senderPublicKey.toString('hex'));
};

export const getKeypairByPkey = (pk: publicKey): IKeypair => {
  const d = findDelegateByPkey(pk);
  if (typeof d === 'undefined') {
    throw new Error('cannot find delegate for this pk ' + pk);
  }
  const ed = new Crypto();
  return ed.makeKeyPair(
    crypto
      .createHash('sha256')
      .update(d.secret, 'utf8')
      .digest()
  );
};
export const getSelfTransportPeer = (): Peer => {
  const peerFactory = initializer.appManager.container.get<(a: any) => Peer>(
    p2pSymbols.logic.peerFactory
  );

  return peerFactory({ ip: '127.0.0.1', port: 9999 });
};

export const enqueueAndProcessTransactions = async (
  txs: Array<ITransaction<any>>
) => {
  const poolManager = initializer.appManager.container.get<PoolManager>(
    TXSymbols.poolManager
  );
  const postTXReq = initializer.appManager.container.getNamed<
    PostTransactionsRequest
  >(p2pSymbols.transportMethod, TXSymbols.p2p.postTxRequest);
  const p = getSelfTransportPeer();
  await p.makeRequest(postTXReq, {
    body: { transactions: txs.map((t) => toBufferedTransaction(t) as any) },
  });
  await poolManager.processPool();
};

export const confirmTransactions = async (
  txs: Array<ITransaction<any>>,
  withTxPool: boolean
) => {
  txs = txs.slice();
  const consts = initializer.appManager.container.get<ConstantsType>(
    Symbols.generic.constants
  );
  if (withTxPool) {
    const txPool = initializer.appManager.container.get<TransactionPool>(
      TXSymbols.pool
    );
    try {
      for (const tx of txs) {
        await enqueueAndProcessTransactions([tx]);
      }
    } catch (e) {
      console.warn('receive tx err', e);
    }

    await initializer.rawMineBlocks(
      Math.ceil(txs.length / consts.maxTxsPerBlock)
    );

    for (const tx of txs) {
      expect(txPool.transactionInPool(tx.id)).is.false; // (`TX ${tx.id} is still in pool :(`);
    }
    return;
  } else {
    while (txs.length > 0) {
      await initializer.rawMineBlockWithTxs(
        txs
          .splice(0, consts.maxTxsPerBlock)
          .map((t) => toBufferedTransaction(t))
      );
    }
  }
};
export const createRandomWallet = (): LiskWallet => {
  return new dposOffline.wallets.LiskLikeWallet(uuid.v4(), 'R');
};

export const createWallet = (secret: string): LiskWallet => {
  return new dposOffline.wallets.LiskLikeWallet(secret, 'R');
};

export const createVoteTransaction = async (
  confirmations: number,
  from: LiskWallet,
  to: publicKey,
  add: boolean,
  obj: any = {}
): Promise<ITransaction> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(
    Symbols.modules.system
  );
  const tx = dposTXCrafter.createVoteTransaction(
    from,
    systemModule.getFees().fees.vote,
    {
      ...{
        asset: {
          votes: [`${add ? '+' : '-'}${to}`],
        },
      },
      ...obj,
    }
  );
  tx['senderId'] = initializer.appManager.container
    .get<IAccountsModule>(Symbols.modules.accounts)
    .generateAddressByPublicKey(Buffer.from(tx.senderPublicKey, 'hex'));
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const createSecondSignTransaction = async (
  confirmations: number,
  from: LiskWallet,
  pk: publicKey
) => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(
    Symbols.modules.system
  );
  const tx = secondTXCrafter.create2ndSigTX(
    from,
    systemModule.getFees().fees.secondsignature,
    {
      asset: {
        signature: {
          publicKey: pk,
        },
      },
    }
  );
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const easyCreateMultiSignAccount = async (
  howMany: number,
  min: number = howMany
) => {
  const { wallet } = await createRandomAccountWithFunds(Math.pow(10, 11));
  const keys = new Array(howMany).fill(null).map(() => createRandomWallet());
  return createMultiSignAccount(wallet, keys, min);
};

export const createMultiSignAccount = async (
  wallet: LiskWallet,
  keys: LiskWallet[],
  min: number,
  extra: any = {}
) => {
  const { tx, signatures } = createMultiSignTransactionWithSignatures(
    wallet,
    min,
    keys,
    24,
    extra
  );
  const multisigModule = initializer.appManager.container.get<
    MultisignaturesModule
  >(MultisigSymbols.module);

  await enqueueAndProcessTransactions([tx]);
  // We should ask multisignature module to change readyness state of such tx.

  for (const signature of signatures) {
    await multisigModule.onNewSignature({
      signature: Buffer.from(signature, 'hex'),
      transaction: tx.id,
      relays: 10,
    });
  }
  const poolManager = initializer.appManager.container.get<PoolManager>(
    TXSymbols.poolManager
  );
  await poolManager.processPool();

  await initializer.rawMineBlocks(1);

  expect(
    initializer.appManager.container.get<BlocksModule>(
      BlocksSymbols.modules.blocks
    ).lastBlock.transactions
  ).length(1);
  return { wallet, keys, tx };
};

export const createMultiSignTransactionWithSignatures = (
  from: LiskWallet,
  min: number,
  keys: LiskWallet[],
  lifetime: number = 24,
  extra: any
) => {
  const tx = createMultiSignTransaction(
    from,
    min,
    keys.map((k) => `+${k.publicKey}`),
    lifetime,
    extra
  );
  const signatures = keys.map((k) => k.getSignatureOfTransaction(tx));
  return { tx, signatures };
};

export const createMultiSignTransaction = (
  from: LiskWallet,
  min: number,
  keysgroup: publicKey[],
  lifetime: number = 24,
  extra: any = {}
) => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(
    Symbols.modules.system
  );
  const tx = multiTXCrafter.createMultiSigTX(
    from,
    systemModule.getFees().fees.secondsignature,
    {
      ...{
        asset: {
          multisignature: {
            keysgroup,
            lifetime,
            min,
          },
        },
      },
      ...extra,
    }
  );
  tx['senderId'] = initializer.appManager.container
    .get<IAccountsModule>(Symbols.modules.accounts)
    .generateAddressByPublicKey(Buffer.from(tx.senderPublicKey, 'hex'));
  return tx;
};

export const createRegDelegateTransaction = async (
  confirmations: number,
  from: LiskWallet,
  name: string,
  obj: any = {}
): Promise<ITransaction> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(
    Symbols.modules.system
  );
  const tx = dposTXCrafter.createRegDelegateTX(
    from,
    systemModule.getFees().fees.delegate,
    {
      ...{
        asset: {
          delegate: {
            username: name,
          },
        },
      },
      ...obj,
    }
  );
  tx['senderId'] = initializer.appManager.container
    .get<IAccountsModule>(Symbols.modules.accounts)
    .generateAddressByPublicKey(Buffer.from(tx.senderPublicKey, 'hex'));
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const createSendTransaction = async (
  confirmations: number,
  amount: number,
  from: LiskWallet,
  dest: string,
  opts: any = {}
): Promise<ITransaction> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(
    Symbols.modules.system
  );
  const tx = txCrafter.createSendTransaction(
    from,
    dest,
    systemModule.getFees().fees.send,
    { ...{ amount }, ...opts }
  );
  tx['senderId'] = initializer.appManager.container
    .get<IAccountsModule>(Symbols.modules.accounts)
    .generateAddressByPublicKey(Buffer.from(tx.senderPublicKey, 'hex'));
  tx.asset = null;
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const getRandomDelegateSecret = (): string => {
  const d = delegates[Math.floor(Math.random() * delegates.length)];
  return d.secret;
};

export const getRandomDelegateWallet = (): LiskWallet => {
  return new dposOffline.wallets.LiskLikeWallet(getRandomDelegateSecret(), 'R');
};

export const createRandomAccountWithFunds = async (
  howMany: number = 1000,
  recipientWallet: LiskWallet = createRandomWallet()
) => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(
    Symbols.modules.system
  );
  const senderWallet = getRandomDelegateWallet();
  const t = new dposOffline.transactions.SendTx();
  t.set('amount', howMany);
  t.set('fee', systemModule.getFees().fees.send);
  t.set('timestamp', 0);
  t.set('recipientId', recipientWallet.address);
  const tx = senderWallet.signTransaction(t);
  await confirmTransactions([tx], true);
  return {
    delegate: senderWallet,
    txID: tx.id,
    wallet: recipientWallet,
  };
};

export const createRandomAccountsWithFunds = async (
  howManyAccounts: number,
  amount: number
): Promise<
  Array<{ tx: ITransaction; account: LiskWallet; senderWallet: LiskWallet }>
> => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(
    Symbols.modules.system
  );
  const senderWallet = getRandomDelegateWallet();

  const txs = [];
  const accounts: LiskWallet[] = [];
  for (let i = 0; i < howManyAccounts; i++) {
    const randomRecipient = createRandomWallet();
    const t = new dposOffline.transactions.SendTx();
    t.set('amount', amount);
    t.set('fee', systemModule.getFees().fees.send);
    t.set('timestamp', 0);
    t.set('recipientId', randomRecipient.address);
    const signedTx = senderWallet.signTransaction(t);
    txs.push(signedTx);
    accounts.push(randomRecipient);
  }

  await confirmTransactions(txs, false);
  return txs.map((tx, idx) => ({ tx, account: accounts[idx], senderWallet }));
};
