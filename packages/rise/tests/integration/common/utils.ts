import { DelegateAsset, VoteAsset } from '@risevision/core-consensus-dpos';
import { p2pSymbols, Peer } from '@risevision/core-p2p';
import {
  PoolManager,
  PostTransactionsRequest,
  SendTxAsset,
  TransactionPool,
  TXSymbols,
} from '@risevision/core-transactions';
import { toNativeTx } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import {
  IKeypair,
  ISystemModule,
  publicKey,
  Symbols,
} from '@risevision/core-types';
import { expect } from 'chai';
import {
  Address,
  LiskVotesAsset,
  RiseV2,
  RiseV2Transaction,
} from 'dpos-offline';
import * as uuid from 'uuid';
import initializer from './init';

import { As } from 'type-tagger';

// tslint:disable-next-line no-var-requires
const delegates = require('../../../../core-launchpad/tests/unit/assets/genesisDelegates.json');
// tslint:disable-next-line no-var-requires
const genesisBlock = require('../../../../core-launchpad/tests/unit/assets/genesisBlock.json');

export const tempDelegateWallets: {
  [pk: string]: IKeypair & { origPK: string; secret: string; address: Address };
} = {};

// tslint:disable no-console no-unused-expression
export const findDelegateByPkey = (
  pk: publicKey
): {
  secret: string;
  address: string;
  publicKey: string;
  username: string;
} => {
  if (tempDelegateWallets[pk]) {
    return {
      ...findDelegateByPkey(tempDelegateWallets[pk].origPK),
      publicKey: pk,
      secret: tempDelegateWallets[pk].secret,
    };
  }
  const del = delegates.filter((d) => d.keypair.publicKey === pk)[0];
  del.username = genesisBlock.transactions
    .filter((t) => t.type === 2)
    .filter((t) => t.senderPubData.toString('hex') === pk)
    .map((t) => t.asset.delegate.username)[0];

  return del;
};

export const findDelegateByUsername = (username: string) => {
  const tx = genesisBlock.transactions
    .filter((t) => t.type === 2)
    .filter((t) => {
      return t.asset.delegate.username.toLowerCase() === username.toLowerCase();
    })[0];

  return findDelegateByPkey(tx.senderPubData.toString('hex'));
};

export const getKeypairByPkey = (pk: publicKey): IKeypair => {
  const d = findDelegateByPkey(pk);
  if (typeof d === 'undefined') {
    throw new Error('cannot find delegate for this pk ' + pk);
  }
  return RiseV2.deriveKeypair(d.secret);
};

export const getSelfTransportPeer = (): Peer => {
  const peerFactory = initializer.appManager.container.get<(a: any) => Peer>(
    p2pSymbols.logic.peerFactory
  );

  return peerFactory({ ip: '127.0.0.1', port: 9999 });
};

export const enqueueAndProcessTransactions = async (
  txs: Array<RiseV2Transaction<any>>
) => {
  const poolManager = initializer.appManager.container.get<PoolManager>(
    TXSymbols.poolManager
  );
  const postTXReq = initializer.appManager.container.getNamed<
    PostTransactionsRequest
  >(p2pSymbols.transportMethod, TXSymbols.p2p.postTxRequest);
  const p = getSelfTransportPeer();
  await p.makeRequest(postTXReq, {
    body: { transactions: txs.map((t) => ({ ...toNativeTx(t), relays: 0 })) },
  });
  await poolManager.processPool();
};

export const confirmTransactions = async (
  txs: Array<RiseV2Transaction<any>>,
  withTxPool: boolean
) => {
  txs = txs.slice();
  if (withTxPool) {
    const txPool = initializer.appManager.container.get<TransactionPool>(
      TXSymbols.pool
    );
    try {
      await enqueueAndProcessTransactions(txs);
    } catch (e) {
      console.warn('receive tx err', e);
    }

    await initializer.rawMineBlocks(Math.ceil(txs.length / 25));

    const poolManager = initializer.appManager.container.get<PoolManager>(
      TXSymbols.poolManager
    );
    await poolManager.processPool();

    for (const tx of txs) {
      expect(txPool.transactionInPool(tx.id)).is.false; // (`TX ${tx.id} is still in pool :(`);
    }
    return;
  } else {
    while (txs.length > 0) {
      await initializer.rawMineBlockWithTxs(
        txs.splice(0, 25).map((t) => toNativeTx(t))
      );
    }
  }
};
export const createRandomWallet = (): IKeypair & {
  secret: string;
  address: Address;
} => {
  const secret = uuid.v4();
  const wallet = createWallet(secret);
  return {
    ...wallet,
    address: RiseV2.calcAddress(wallet.publicKey, 'main', 'v0'),
    secret,
  };
};

export const createRandomV2Wallet = (): IKeypair & {
  secret: string;
  address: Address;
} => {
  const secret = uuid.v4();
  const wallet = createWalletV2(secret);
  return {
    ...wallet,
    address: RiseV2.calcAddress(wallet.publicKey, 'main', 'v1'),
    secret,
  };
};

export const createWallet = (
  secret: string
): IKeypair & { address: Address } => {
  const wallet = RiseV2.deriveKeypair(secret);
  return {
    ...wallet,
    address: RiseV2.calcAddress(wallet.publicKey, 'main', 'v0'),
  };
};
export const createWalletV2 = (
  secret: string
): IKeypair & { address: Address } => {
  const wallet = RiseV2.deriveKeypair(secret);
  return { ...wallet, address: RiseV2.calcAddress(wallet.publicKey) };
};
export const createVoteTransactionV1 = async (
  confirmations: number,
  from: IKeypair & { address?: Address },
  to: Buffer,
  add: boolean,
  obj: any = {}
): Promise<RiseV2Transaction<LiskVotesAsset>> => {
  const tx = RiseV2.txs.createAndSign(
    {
      kind: 'vote',
      preferences: [
        {
          action: add ? '+' : '-',
          delegateIdentifier: to.toString('hex'),
        },
      ],
      sender: from,
      ...obj,
    },
    from,
    true
  );
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const createVoteTransactionV2 = async (
  from: IKeypair,
  username,
  add: boolean,
  obj: any = {}
): Promise<RiseV2Transaction<VoteAsset>> => {
  const tx = RiseV2.txs.createAndSign(
    {
      kind: 'vote-v2',
      preferences: [
        {
          action: add ? '+' : '-',
          delegateIdentifier: username,
        },
      ],
      sender: from,
      ...obj,
    },
    from,
    true
  );
  return tx;
};
export const createSecondSignTransactionV1 = async (
  confirmations: number,
  from: IKeypair,
  pk: Buffer & As<'publicKey'>
) => {
  const systemModule = initializer.appManager.container.get<ISystemModule>(
    Symbols.modules.system
  );
  const tx = RiseV2.txs.createAndSign(
    {
      fee: systemModule.getFees().fees.secondsignature.toString(),
      kind: 'second-signature',
      nonce: '0' as string & As<'nonce'>,
      publicKey: pk,
      sender: from,
    },
    from,
    true
  );

  tx.asset.signature.publicKey = Buffer.from(
    tx.asset.signature.publicKey,
    'hex'
  );
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const createRegDelegateTransactionV1 = async (
  confirmations: number,
  from: IKeypair,
  name: string
): Promise<RiseV2Transaction<any>> => {
  const tx = RiseV2.txs.createAndSign(
    {
      identifier: name as string & As<'delegateName'>,
      kind: 'register-delegate',
      nonce: '0' as string & As<'nonce'>,
      sender: from,
    },
    from,
    true
  );

  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const createRegDelegateTransactionV2 = async (
  from: IKeypair,
  identifier: string,
  forgingPublicKey: Buffer & As<'publicKey'>
): Promise<RiseV2Transaction<DelegateAsset>> => {
  // IRiseV2RegisterDelegateTx
  return RiseV2.txs.createAndSign(
    {
      forgingPublicKey,
      identifier: identifier as string & As<'delegateName'>,
      kind: 'register-delegate-v2',
      sender: from,
    },
    from,
    true
  );
};

export const createSendTransactionV2 = (
  amount: number | bigint,
  from: IKeypair & { address?: string },
  dest: string,
  conf: {
    timestamp?: number;
    asset?: Buffer;
    fee?: string;
  } = {}
): RiseV2Transaction<SendTxAsset> => {
  const tx = RiseV2.txs.createAndSign(
    {
      amount: `${amount}`,
      fee: conf ? conf.fee : null,
      kind: 'send-v2',
      memo: conf ? conf.asset : null,
      nonce: `${conf ? conf.timestamp || 0 : 0}` as string & As<'nonce'>,
      recipient: dest as string & As<'address'>,
      sender: from,
    },
    from,
    true
  );
  return tx;
};

export const createSendTransactionV1 = async (
  confirmations: number,
  amount: number | bigint,
  from: IKeypair,
  dest: string,
  timestamp: number = 0
): Promise<RiseV2Transaction<any>> => {
  const tx = RiseV2.txs.createAndSign(
    {
      amount: `${amount}`,
      kind: 'send',
      nonce: `${timestamp}` as string & As<'nonce'>,
      recipient: dest as string & As<'address'>,
      sender: {
        ...from,
        address: RiseV2.calcAddress(from.publicKey, 'main', 'v0'),
      },
    },
    from,
    true
  );
  if (confirmations > 0) {
    await confirmTransactions([tx], true);
  }
  return tx;
};

export const getRandomDelegateSecret = (): string => {
  const d = delegates[Math.floor(Math.random() * delegates.length)];
  return d.secret;
};

export const getRandomDelegateWallet = (): IKeypair & { address: Address } => {
  return createWallet(getRandomDelegateSecret());
};

export const createRandomAccountWithFunds = async (
  howMany: number = 1000,
  recipientWallet: IKeypair & { address: Address } = createRandomWallet()
) => {
  const senderWallet = getRandomDelegateWallet();
  const tx = await createSendTransactionV1(
    1,
    howMany,
    senderWallet,
    recipientWallet.address
  );
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
  Array<{
    tx: RiseV2Transaction<any>;
    account: IKeypair;
    senderWallet: IKeypair;
  }>
> => {
  const senderWallet = getRandomDelegateWallet();

  const txs = [];
  const accounts: IKeypair[] = [];
  for (let i = 0; i < howManyAccounts; i++) {
    const randomRecipient = createRandomWallet();
    const t = await createSendTransactionV1(
      0,
      amount,
      senderWallet,
      RiseV2.calcAddress(randomRecipient.publicKey, 'main', 'v0')
    );
    txs.push(toNativeTx(t));
    accounts.push(randomRecipient);
  }

  await confirmTransactions(txs, false);
  return txs.map((tx, idx) => ({ tx, account: accounts[idx], senderWallet }));
};
