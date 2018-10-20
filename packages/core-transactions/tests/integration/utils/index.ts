import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import { Container } from 'inversify';
import { PoolManager, PostTransactionsRequest, TXSymbols } from '../../../src';
import { p2pSymbols, Peer } from '@risevision/core-p2p';
import { toBufferedTransaction } from '../../unit/utils/txCrafter';

export const txBroadcast = (tx: Array<ITransaction<any>>, container: Container, peer: Peer): Promise<any> => {
  const ptr = container.getNamed<PostTransactionsRequest>(p2pSymbols.transportMethod, TXSymbols.p2p.postTxRequest);
  return peer.makeRequest(
    ptr,
    {
      body: { transactions: tx.map((t) => ({ ...toBufferedTransaction(t), relays: 30 })) },
    });
};

export const poolProcess = (container: Container): Promise<void> => {
  const poolManager = container.get<PoolManager>(TXSymbols.poolManager);
  return poolManager.processPool();
};
