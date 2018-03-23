import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { Bus } from '../../../src/helpers';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('helpers/bus', () => {
  let sandbox: SinonSandbox;
  let instance: Bus;
  let stub: any;
  let stub2: any;
  let stub4: any;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    instance = new Bus();
    stub = sandbox.stub().resolves(true);
    stub4 = sandbox.stub().returns(undefined);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('receiveBlock', () => {
    it('success', async () => {
      instance.modules = [{ onReceiveBlock: stub }];
      await instance.message('receiveBlock', { the: 'block' } as any);
      expect(stub.calledOnce).to.be.true;
      expect(stub.args[0][0]).to.be.deep.eq({ the: 'block' });
    });

    it('success without Promise', async () => {
      instance.modules = [{ onReceiveBlock: stub4 }];
      await instance.message('receiveBlock', { the: 'block' } as any);
      expect(stub4.calledOnce).to.be.true;
      expect(stub4.args[0][0]).to.be.deep.eq({ the: 'block' });
    });
  });

  describe('finishRound', () => {
    it('success', async () => {
      instance.modules = [{ onFinishRound: stub }];
      await instance.message('finishRound', 10);
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.equal(10);
    });

    it('success without Promise', async () => {
      instance.modules = [{ onFinishRound: stub4 }];
      await instance.message('finishRound', 10);
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.equal(10);
    });
  });

  describe('transactionsSaved', () => {
    it('success', async () => {
      instance.modules = [{ onTransactionsSaved: stub }];
      await instance.message('transactionsSaved', [1, 2, 3] as any);
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.be.equalTo([1, 2, 3]);
    });

    it('success without Promise', async () => {
      instance.modules = [{ onTransactionsSaved: stub4 }];
      await instance.message('transactionsSaved', [1, 2, 3] as any);
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.be.equalTo([1, 2, 3]);
    });
  });

  describe('blockchainReady', () => {
    it('success', async () => {
      instance.modules = [{ onBlockchainReady: stub }];
      await instance.message('blockchainReady');
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.be.undefined;
    });

    it('success without Promise', async () => {
      instance.modules = [{ onBlockchainReady: stub4 }];
      await instance.message('blockchainReady');
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.be.undefined;
    });
  });

  describe('syncStarted', () => {
    it('success', async () => {
      instance.modules = [{ onSyncStarted: stub }];
      await instance.message('syncStarted');
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.be.undefined;
    });

    it('success without Promise', async () => {
      instance.modules = [{ onSyncStarted: stub4 }];
      await instance.message('syncStarted');
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.be.undefined;
    });
  });

  describe('syncFinished', () => {
    it('success', async () => {
      instance.modules = [{ onSyncFinished: stub }];
      await instance.message('syncFinished');
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.be.undefined;
    });

    it('success without Promise', async () => {
      instance.modules = [{ onSyncFinished: stub4 }];
      await instance.message('syncFinished');
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.be.undefined;
    });
  });

  describe('peersReady', () => {
    it('success', async () => {
      instance.modules = [{ onPeersReady: stub }];
      await instance.message('peersReady');
      expect(stub.calledOnce).is.true;
    });

    it('success without Promise', async () => {
      instance.modules = [{ onPeersReady: stub4 }];
      await instance.message('peersReady');
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.be.undefined;
    });
  });

  describe('newBlock', () => {
    it('success', async () => {
      instance.modules = [{ onNewBlock: stub }];
      await instance.message('newBlock', { foo: 'bar' } as any, true);
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.deep.equal({ foo: 'bar' });
      expect(stub.args[0][1]).to.be.true;
    });

    it('success without Promise', async () => {
      instance.modules = [{ onNewBlock: stub4 }];
      await instance.message('newBlock', { foo: 'bar' } as any, true);
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.deep.equal({ foo: 'bar' });
      expect(stub4.args[0][1]).to.be.true;
    });
  });

  describe('signature', () => {
    it('success', async () => {
      instance.modules = [{ onSignature: stub }];
      await instance.message(
        'signature',
        { transaction: 'foo', signature: 123 },
        true
      );
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.deep.equal({
        signature: 123,
        transaction: 'foo',
      });
      expect(stub.args[0][1]).to.be.true;
    });

    it('success without Promise', async () => {
      instance.modules = [{ onSignature: stub4 }];
      await instance.message(
        'signature',
        { transaction: 'foo', signature: 123 },
        true
      );
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.deep.equal({
        signature: 123,
        transaction: 'foo',
      });
      expect(stub4.args[0][1]).to.be.true;
    });
  });

  describe('unconfirmedTransaction', () => {
    it('success', async () => {
      instance.modules = [{ onUnconfirmedTransaction: stub }];
      await instance.message('unconfirmedTransaction', 'abc', true);
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.equal('abc');
      expect(stub.args[0][1]).to.be.true;
    });

    it('success without Promise', async () => {
      instance.modules = [{ onUnconfirmedTransaction: stub4 }];
      await instance.message('unconfirmedTransaction', 'abc', true);
      expect(stub4.calledOnce).is.true;
      expect(stub4.args[0][0]).to.equal('abc');
      expect(stub4.args[0][1]).to.be.true;
    });
  });

  describe('Testing multiple listeners', () => {
    it('success', async () => {
      stub2 = sandbox.stub().resolves();
      instance.modules = [{ onReceiveBlock: stub }, { onReceiveBlock: stub2 }];
      await instance.message('receiveBlock', { the: 'block' } as any);
      expect(stub.calledOnce).is.true;
      expect(stub.args[0][0]).to.be.deep.eq({ the: 'block' });
      expect(stub2.calledOnce).is.true;
      expect(stub2.args[0][0]).to.be.deep.eq({ the: 'block' });
      expect(stub.calledBefore(stub2)).is.true;
      expect(stub2.calledAfter(stub)).is.true;
    });
  });

  describe('Without listeners available', () => {
    it('success', async () => {
      stub2 = sandbox.stub().resolves();
      instance.modules = [
        { onUnconfirmedTransaction: stub },
        { onUnconfirmedTransaction: stub2 },
      ];
      await instance.message('receiveBlock', { the: 'block' } as any);
      expect(stub.called).is.false;
      expect(stub2.called).is.false;
    });
  });
});
