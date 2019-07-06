import { p2pSymbols, Peer } from '@risevision/core-p2p';
import { RiseV2Transaction } from 'dpos-offline';
import { Container } from 'inversify';
import { PoolManager, PostTransactionsRequest, TXSymbols } from '../../../src';
import { toNativeTx } from '../../unit/utils/txCrafter';

export const txBroadcast = (
  tx: Array<RiseV2Transaction<any>>,
  container: Container,
  peer: Peer
): Promise<any> => {
  const ptr = container.getNamed<PostTransactionsRequest>(
    p2pSymbols.transportMethod,
    TXSymbols.p2p.postTxRequest
  );
  return peer.makeRequest(ptr, {
    body: {
      transactions: tx.map((t) => ({
        ...toNativeTx(t),
        relays: 30,
      })),
    },
  });
};

export const poolProcess = (container: Container): Promise<void> => {
  const poolManager = container.get<PoolManager>(TXSymbols.poolManager);
  return poolManager.processPool();
};
