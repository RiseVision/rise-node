import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { GetSignaturesRequest } from '../../../src';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { p2pSymbols } from '@risevision/core-p2p';
import { Container } from 'inversify';
import { MultisigSymbols } from '../../../src';
import { ITransactionPool } from '@risevision/core-interfaces';
import { createRandomTransaction, toBufferedTransaction } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { generateAccount } from '@risevision/core-accounts/tests/unit/utils/accountsUtils';
import { TXSymbols } from '@risevision/core-transactions';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('apis/requests/GetSignaturesRequest', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: GetSignaturesRequest;
  let txPool: ITransactionPool;
  before(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-blocks', 'core-helpers', 'core', 'core-accounts', 'core-transactions', 'core-multisignature']);
  });
  beforeEach(() => {
    sandbox.restore();
    instance = container.getNamed(p2pSymbols.transportMethod, MultisigSymbols.p2p.getSignatures);
    txPool   = container.get(TXSymbols.pool);
    txPool.pending.list().forEach((a) => txPool.pending.remove(a.tx.id));
  });

  async function createRequest(query: any, body: null) {
    const r    = await instance.createRequestOptions({ query, body });
    const resp = await instance.handleRequest(r.data, r.query);
    return instance.handleResponse(null, resp);
  }

  describe('in/out', () => {
    it('should encode/decode data properly', async () => {
      const txs = new Array(5).fill(null)
        .map(() => createRandomTransaction())
        .map((t, indx) => {
          t.signatures = [];
          for (let i = 0; i < indx; i++) {
            t.signatures.push(generateAccount().getSignatureOfTransaction(t));
          }
          return t;
        })
        .map((t) => toBufferedTransaction(t));

      for (const tx of txs) {
        txPool.pending.add(tx, { receivedAt: new Date(), ready: false });
      }

      const resp = await createRequest(null, null);
      expect(resp).deep.eq({
        signatures: txs.slice(1).reverse().map((t) => ({ transaction: t.id, signatures: t.signatures })),
      });
    });
  });
  it('should validate response', async () => {
    txPool.pending.add({
      id        : 'a',
      signatures: [Buffer.from(new Array(128).fill('a').join(''), 'hex')],
    } as any, { receivedAt: new Date(), ready: false });
    await expect(createRequest(null, null)).rejectedWith('format txId');
    txPool.removeFromPool('a');

    txPool.pending.add({
      id        : '123123123123',
      signatures: [new Buffer('meow')],
    } as any, { receivedAt: new Date(), ready: false });
    await expect(createRequest(null, null)).rejectedWith('signatureBuf');
  });
});
