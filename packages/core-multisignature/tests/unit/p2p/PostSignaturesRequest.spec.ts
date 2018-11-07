import { generateAccount } from '@risevision/core-accounts/tests/unit/utils/accountsUtils';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { p2pSymbols } from '@risevision/core-p2p';
import {
  createRandomTransaction,
  toBufferedTransaction,
} from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { IBaseTransaction } from '@risevision/core-types';
import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import {
  MultisignaturesModule,
  MultisigSymbols,
  MultisigTransportModule,
  PostSignaturesRequest,
  PostSignaturesRequestDataType,
} from '../../../src';

// tslint:disable no-unused-expression
describe('apis/requests/PostSignaturesRequest', () => {
  let instance: PostSignaturesRequest;
  let sandbox: SinonSandbox;
  let container: Container;
  let multiModule: MultisignaturesModule;
  let multiTransport: MultisigTransportModule;
  let txs: Array<IBaseTransaction<any>>;
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
      MultisigSymbols.p2p.postSignatures
    );
    multiModule = container.get(MultisigSymbols.module);
    multiTransport = container.get(MultisigSymbols.multiSigTransport);
    txs = new Array(5)
      .fill(null)
      .map(() => createRandomTransaction())
      .map((t, indx) => {
        t.signatures = [];
        for (let i = 0; i < indx; i++) {
          t.signatures.push(generateAccount().getSignatureOfTransaction(t));
        }
        return t;
      })
      .map((t) => toBufferedTransaction(t));
  });

  async function createRequest(body: PostSignaturesRequestDataType) {
    const r = await instance.createRequestOptions({ body });
    const resp = await instance.handleRequest({
      body: r.data,
      query: r.query,
      requester: null,
    });
    return instance.handleResponse(null, resp);
  }

  it('i/o', async () => {
    const spy = sandbox.spy(multiModule, 'onNewSignature');
    await createRequest({
      signatures: [
        {
          relays: 1,
          signature: txs[1].signatures[0],
          transaction: txs[1].id,
        },
      ],
    });
    expect(spy.called).true;
    expect(spy.firstCall.args[0]).deep.eq({
      relays: 1,
      signature: txs[1].signatures[0],
      transaction: txs[1].id,
    });
  });
});
