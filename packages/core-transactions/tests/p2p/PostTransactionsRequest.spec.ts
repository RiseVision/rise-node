import * as sinon from 'sinon';
import { expect } from 'chai';
import { SinonSandbox } from 'sinon';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { PostTransactionsRequest, TransactionsModule, TXSymbols } from '../../src';
import { Container } from 'inversify';
import { RequestFactoryType } from '@risevision/core-p2p';
import { ITransactionLogic } from '@risevision/core-interfaces';
import { createRandomTransactions } from '../utils/txCrafter';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';

// tslint:disable no-unused-expression
describe('apis/requests/PostTransactionsRequest', () => {
  let container: Container;
  let factory: RequestFactoryType<any, PostTransactionsRequest>;
  let txLogic: ITransactionLogic;
  let protoBuf: ProtoBufHelper;
  let sandbox: SinonSandbox;
  before(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
  });
  beforeEach(async () => {
    factory  = container.get<RequestFactoryType<any, PostTransactionsRequest>>(TXSymbols.p2p.postTxRequest);
    txLogic  = container.get(TXSymbols.logic);
    protoBuf = container.get(p2pSymbols.helpers.protoBuf);
    sandbox.restore();
  });

  describe('request encoding', () => {
    it('should be readable using protobuf.', async () => {
      const txs      = createRandomTransactions(1)
        .map((t) => txLogic.objectNormalize(t));
      const instance = factory({ data: { transactions: txs } });
      const opts     = instance.getRequestOptions();
      const res      = protoBuf.decode(opts.data, 'transactions.transport', 'transportTransactions');
      expect(res.transactions.map((t) => t.toString('hex'))).deep
        .eq(txs.map((t) => txLogic.toProtoBuffer(t).toString('hex')));
    });
  });

  describe('mergeIntoThis', () => {
    it('should merge other requests into one', () => {
      const txs       = createRandomTransactions(1)
        .map((t) => txLogic.objectNormalize(t));
      const instance  = factory({ data: { transactions: txs } });
      const instance3 = factory({
        data: {
          transactions: createRandomTransactions(5)
            .map((t) => txLogic.objectNormalize(t)),
        },
      });

      instance.mergeIntoThis(instance, instance3);

      expect(instance.options.data.transactions.length).eq(1 + 5);
    });
    it('should remove duplicates', () => {
      const txs       = createRandomTransactions(1)
        .map((t) => txLogic.objectNormalize(t));
      const instance  = factory({ data: { transactions: txs } });
      const instance3 = factory({
        data: {
          transactions: createRandomTransactions(5)
            .map((t) => txLogic.objectNormalize(t)).concat(txs),
        },
      });

      instance.mergeIntoThis(instance, instance3);

      expect(instance.options.data.transactions.length).eq(1 + 5);
    });
  });

  describe('isRequestExpired', () => {

    it('should return true if all txs are confirmed', async () => {
      const txs       = createRandomTransactions(10)
        .map((t) => txLogic.objectNormalize(t));
      const instance  = factory({ data: { transactions: txs } });
      const txModule: TransactionsModule = container.get(TXSymbols.module);
      sandbox.stub(txModule, 'filterConfirmedIds').resolves(txs.map((t) => t.id));

      expect(await instance.isRequestExpired()).true;
    });
    it('should return false if at least one  of the tx is unconfirmed', async () => {
      const txs       = createRandomTransactions(10)
        .map((t) => txLogic.objectNormalize(t));
      const instance  = factory({ data: { transactions: txs } });
      const txModule: TransactionsModule = container.get(TXSymbols.module);
      sandbox.stub(txModule, 'filterConfirmedIds')
        .resolves(txs.slice(1).map((t) => t.id));

      expect(await instance.isRequestExpired()).false;
    });
  });
});
