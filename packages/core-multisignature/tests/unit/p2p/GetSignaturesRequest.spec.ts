import { generateAccount } from '@risevision/core-accounts/tests/unit/utils/accountsUtils';
import { ITransactionPool } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { p2pSymbols } from '@risevision/core-p2p';
import { TXSymbols } from '@risevision/core-transactions';
import {
  createRandomTransaction,
  toNativeTx,
} from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { GetSignaturesRequest } from '../../../src';
import { MultisigSymbols } from '../../../src';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('apis/requests/GetSignaturesRequest', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: GetSignaturesRequest;
  let txPool: ITransactionPool;
  before(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-blocks',
      'core-helpers',
      'core-crypto',
      'core',
      'core-accounts',
      'core-transactions',
      'core-multisignature',
    ]);
  });
  beforeEach(() => {
    sandbox.restore();
    instance = container.getNamed(
      p2pSymbols.transportMethod,
      MultisigSymbols.p2p.getSignatures
    );
    txPool = container.get(TXSymbols.pool);
    txPool.pending.list().forEach((a) => txPool.pending.remove(a.tx.id));
  });

  async function createRequest(query: any, body: null) {
    const r = await instance.createRequestOptions({ query, body });
    const resp = await instance.handleRequest({
      body: r.data as any,
      query: r.query,
      requester: null,
    });
    return instance.handleResponse(null, resp);
  }

  describe('in/out', () => {
    it('should encode/decode data properly', async () => {
      const txs = new Array(5)
        .fill(null)
        .map(() => createRandomTransaction())
        .map((t, indx) => {
          t.signatures = [];
          for (let i = 0; i < indx; i++) {
            t.signatures.push(RiseV2.txs.calcSignature(t, generateAccount()));
          }
          return t;
        })
        .map((t) => toNativeTx(t));

      for (const tx of txs) {
        txPool.pending.add(tx, { receivedAt: new Date(), ready: false });
      }

      const resp = await createRequest(null, null);
      expect(resp).deep.eq({
        signatures: txs
          .slice(1)
          .reverse()
          .map((t) => ({ transaction: t.id, signatures: t.signatures })),
      });
    });
  });
  it('should validate response', async () => {
    txPool.pending.add(
      {
        id: 'a',
        signatures: [Buffer.from(new Array(128).fill('a').join(''), 'hex')],
      } as any,
      { receivedAt: new Date(), ready: false }
    );
    await expect(createRequest(null, null)).rejectedWith('format txId');
    txPool.removeFromPool('a');

    txPool.pending.add(
      {
        id: '123123123123',
        signatures: [new Buffer('meow')],
      } as any,
      { receivedAt: new Date(), ready: false }
    );
    await expect(createRequest(null, null)).rejectedWith('signatureBuf');
  });
});
