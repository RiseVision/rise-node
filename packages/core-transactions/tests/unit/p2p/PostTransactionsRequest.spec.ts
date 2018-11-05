import { ITransactionLogic } from '@risevision/core-interfaces';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { createContainer } from '../../../../core-launchpad/tests/unit/utils/createContainer';
import {
  PostTransactionsRequest,
  TransactionsModule,
  TXSymbols,
} from '../../../src';
import { createRandomTransactions } from '../utils/txCrafter';

// tslint:disable no-unused-expression
describe('apis/requests/PostTransactionsRequest', () => {
  let container: Container;
  let txLogic: ITransactionLogic;
  let protoBuf: ProtoBufHelper;
  let sandbox: SinonSandbox;
  let instance: PostTransactionsRequest;
  before(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-p2p',
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core-transactions',
      'core',
      'core-accounts',
    ]);
  });
  beforeEach(async () => {
    txLogic = container.get(TXSymbols.logic);
    protoBuf = container.get(p2pSymbols.helpers.protoBuf);
    instance = container.getNamed(
      p2pSymbols.transportMethod,
      TXSymbols.p2p.postTxRequest
    );
    sandbox.restore();
  });

  describe('mergeRequests', () => {
    it('should merge other requests into one', () => {
      const txs = createRandomTransactions(1).map((t) => ({
        ...txLogic.objectNormalize(t),
        relays: 1,
      }));
      const body1 = { body: { transactions: txs } };
      const body2 = {
        body: {
          transactions: createRandomTransactions(5).map((t) => ({
            ...txLogic.objectNormalize(t),
            relays: 1,
          })),
        },
      };

      const res = instance.mergeRequests([body1, body2]);
      expect(res.length).eq(1);
      expect(res[0].body.transactions.length).eq(1 + 5);
    });
    it('should remove duplicates', () => {
      const txs = createRandomTransactions(1).map((t) => ({
        ...txLogic.objectNormalize(t),
        relays: 1,
      }));
      const body = { body: { transactions: txs } };
      const body2 = {
        body: {
          transactions: createRandomTransactions(5)
            .map((t) => ({ ...txLogic.objectNormalize(t), relays: 1 }))
            .concat(txs),
        },
      };

      const res = instance.mergeRequests([body, body2]);
      expect(res.length).eq(1);
      expect(res[0].body.transactions.length).eq(1 + 5);
    });
  });

  describe('isRequestExpired', () => {
    it('should return true if all txs are confirmed', async () => {
      const txs = createRandomTransactions(10).map((t) =>
        txLogic.objectNormalize(t)
      );
      const txModule: TransactionsModule = container.get(TXSymbols.module);
      sandbox
        .stub(txModule, 'filterConfirmedIds')
        .resolves(txs.map((t) => t.id));

      expect(
        await instance.isRequestExpired({ body: { transactions: txs as any } })
      ).true;
    });
    it('should return false if at least one  of the tx is unconfirmed', async () => {
      const txs = createRandomTransactions(10).map((t) =>
        txLogic.objectNormalize(t)
      );
      const txModule: TransactionsModule = container.get(TXSymbols.module);
      sandbox
        .stub(txModule, 'filterConfirmedIds')
        .resolves(txs.slice(1).map((t) => t.id));

      expect(
        await instance.isRequestExpired({ body: { transactions: txs as any } })
      ).false;
    });
  });
});
