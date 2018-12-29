import { Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { p2pSymbols } from '@risevision/core-p2p';
import { createFakePeer } from '@risevision/core-p2p/tests/unit/utils/fakePeersFactory';
import { expect } from 'chai';
import { RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import { generateAccount } from '../../../../core-accounts/tests/unit/utils/accountsUtils';
import { ConstantsType } from '../../../../core-types/src';
import {
  GetTransactionsRequest,
  TransactionPool,
  TXSymbols,
} from '../../../src/';
import { createRandomTransaction, toNativeTx } from '../utils/txCrafter';

// tslint:disable no-unused-expression
describe('apis/requests/GetTransactionsRequest', () => {
  let instance: GetTransactionsRequest;
  let peer: any;
  let container: Container;

  let txPool: TransactionPool;
  beforeEach(async () => {
    container = await createContainer([
      'core-transactions',
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core',
      'core-accounts',
    ]);
    instance = container.getNamed(
      p2pSymbols.transportMethod,
      TXSymbols.p2p.getTransactions
    );
    txPool = container.get(TXSymbols.pool);
    peer = createFakePeer();
  });

  async function createRequest() {
    const { data } = await instance.createRequestOptions();
    const resp = await instance.handleRequest({ body: data, query: null });
    return instance.handleResponse(null, resp);
  }

  it('emptytest', async () => {
    const finalData = await createRequest();
    expect(finalData).deep.eq({ transactions: [] });
  });
  it('with 1 tx', async () => {
    const tx = toNativeTx(createRandomTransaction());
    txPool.unconfirmed.add(tx, { receivedAt: new Date() });
    const finalData = await createRequest();
    expect(finalData).deep.eq({
      transactions: [{ ...tx, relays: 3, signatures: [], asset: null }],
    });
  });
  it('with some txs from dif pool - order is respected', async () => {
    const unconfirmed = toNativeTx(createRandomTransaction());
    const pending = toNativeTx(createRandomTransaction());
    const ready = toNativeTx(createRandomTransaction());

    txPool.unconfirmed.add(unconfirmed, { receivedAt: new Date() });
    txPool.pending.add(pending, { receivedAt: new Date(), ready: false });
    txPool.ready.add(ready, { receivedAt: new Date() });

    const finalData = await createRequest();
    expect(finalData).deep.eq({
      transactions: [unconfirmed, pending, ready].map((t) => ({
        ...t,
        asset: null,
        relays: 3,
        signatures: [],
      })),
    });
  });
  it('with some signatures', async () => {
    const t = createRandomTransaction();
    const unconfirmed = toNativeTx(t);
    unconfirmed.signatures = new Array(3)
      .fill(null)
      .map(() => RiseV2.txs.calcSignature(t, generateAccount()));
    txPool.unconfirmed.add(unconfirmed, { receivedAt: new Date() });
    const finalData = await createRequest();
    expect(finalData.transactions).not.empty;
    expect(finalData.transactions[0].signatures).not.empty;
    expect(finalData.transactions[0].signatures.length).eq(3);
    expect(finalData.transactions[0].signatures).deep.eq(
      unconfirmed.signatures
    );
  });
  it('should honor limit', async () => {
    const constants = container.get<ConstantsType>(Symbols.generic.constants);
    constants.maxSharedTxs = 10;
    new Array(10)
      .fill(null)
      .map(() => toNativeTx(createRandomTransaction()))
      .forEach((t) => txPool.unconfirmed.add(t, { receivedAt: new Date() }));
    txPool.pending.add(toNativeTx(createRandomTransaction()), {
      ready: false,
      receivedAt: new Date(),
    });
    txPool.ready.add(toNativeTx(createRandomTransaction()), {
      receivedAt: new Date(),
    });
    const finalData = await createRequest();
    expect(finalData.transactions.length).eq(10);
  });
});
