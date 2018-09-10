import { expect } from 'chai';
import { GetTransactionsRequest, TransactionLogic, TXSymbols } from '../../src/';
import { createFakePeer } from '@risevision/core-p2p/tests/utils/fakePeersFactory';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { Container } from 'inversify';
import { RequestFactoryType } from '@risevision/core-p2p';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import { createRandomTransactions } from '../utils/txCrafter';

// tslint:disable no-unused-expression
describe('apis/requests/GetTransactionsRequest', () => {
  let instance: GetTransactionsRequest;
  let peer: any;
  let container: Container;
  before(async () => {
    container = await createContainer(['core-transactions', 'core-helpers', 'core-blocks', 'core', 'core-accounts']);
  });
  beforeEach(() => {
    const factory = container.get<RequestFactoryType<any, any>>(TXSymbols.p2p.getTransactions)
    instance = factory({data: null});
    peer             = createFakePeer();
  });

  describe('getResponseData', () => {
    it('should decode valid response', async () => {
      const protoBuf = container.get<ProtoBufHelper>(p2pSymbols.helpers.protoBuf);
      const txLogic = container.get<TransactionLogic>(TXSymbols.logic);
      const txs = createRandomTransactions(10)
        .map((t) => txLogic.objectNormalize(t));
      const byteTxs = txs
        .map((tx, idx) => txLogic.toProtoBuffer({
          ...tx,
          relays: idx
        }));
      const buf = protoBuf.encode(
        { transactions: byteTxs },
        'transactions.transport',
        'transportTransactions'
      );
      const bit = instance.getResponseData({ body: buf, peer});
      expect(bit).deep.eq({
        transactions: txs.map((tx, idx) => ({...tx, relays: idx, asset: null, requesterPublicKey: null}))
      });
    });
    it('should handle null buffer', async () => {
      expect(() => instance.getResponseData({body: null, peer}))
        .throw;
    });
    it('should handle invalid buffer', async () => {
      expect(() => instance.getResponseData({body: new Buffer('meow'), peer}))
        .throw;
    });
  });
});
