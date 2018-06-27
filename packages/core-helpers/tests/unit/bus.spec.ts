import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { Bus } from '../src/';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression max-line-length
describe('helpers/bus', () => {
  let sandbox: SinonSandbox;
  let instance: Bus;
  let promiseStub: any;
  let promiseStub2: any;
  let functionStub: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    instance = new Bus();
    promiseStub = sandbox.stub().resolves(true);
    promiseStub2 = sandbox.stub().resolves(true);
    functionStub = sandbox.stub().returns(undefined);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('receiveBlock', () => {
    it('Promise case: should call to onReceiveBlock() with the same object received as second argument from message()', async () => {
      instance.modules = [{ onReceiveBlock: promiseStub }];
      await instance.message('receiveBlock', { the: 'block' } as any);
      expect(promiseStub.calledOnce).to.be.true;
      expect(promiseStub.args[0][0]).to.be.deep.eq({ the: 'block' });
    });

    it('Function case: should call to onReceiveBlock() with the same object received as second argument from message()', async () => {
      instance.modules = [{ onReceiveBlock: functionStub }];
      await instance.message('receiveBlock', { the: 'block' } as any);
      expect(functionStub.calledOnce).to.be.true;
      expect(functionStub.args[0][0]).to.be.deep.eq({ the: 'block' });
    });
  });

  describe('finishRound', () => {
    it('Promise case: should call to onFinishRound() with the same round value received from message()', async () => {
      instance.modules = [{ onFinishRound: promiseStub }];
      await instance.message('finishRound', 10);
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.equal(10);
    });

    it('Function case: should call to onFinishRound() with the same round value received from message()', async () => {
      instance.modules = [{ onFinishRound: functionStub }];
      await instance.message('finishRound', 10);
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.equal(10);
    });
  });

  describe('transactionsSaved', () => {
    it('Promise case: should call to onTransactionsSaved() with the same Array received from message()', async () => {
      instance.modules = [{ onTransactionsSaved: promiseStub }];
      await instance.message('transactionsSaved', [1, 2, 3] as any);
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.be.equalTo([1, 2, 3]);
    });

    it('Function case: should call to onTransactionsSaved() with the same Array received from message()', async () => {
      instance.modules = [{ onTransactionsSaved: functionStub }];
      await instance.message('transactionsSaved', [1, 2, 3] as any);
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.be.equalTo([1, 2, 3]);
    });
  });

  describe('blockchainReady', () => {
    it('Promise case: should call to onBlockchainReady() without parameters', async () => {
      instance.modules = [{ onBlockchainReady: promiseStub }];
      await instance.message('blockchainReady');
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.be.undefined;
    });

    it('Function case: should call to onBlockchainReady() without parameters', async () => {
      instance.modules = [{ onBlockchainReady: functionStub }];
      await instance.message('blockchainReady');
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.be.undefined;
    });
  });

  describe('syncStarted', () => {
    it('Promise case: should call to onSyncStarted() without parameters', async () => {
      instance.modules = [{ onSyncStarted: promiseStub }];
      await instance.message('syncStarted');
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.be.undefined;
    });

    it('Function case: should call to onSyncStarted() without parameters', async () => {
      instance.modules = [{ onSyncStarted: functionStub }];
      await instance.message('syncStarted');
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.be.undefined;
    });
  });

  describe('syncFinished', () => {
    it('Promise case: should call to onSyncFinished() without parameters', async () => {
      instance.modules = [{ onSyncFinished: promiseStub }];
      await instance.message('syncFinished');
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.be.undefined;
    });

    it('Function case: should call to onSyncFinished() without parameters', async () => {
      instance.modules = [{ onSyncFinished: functionStub }];
      await instance.message('syncFinished');
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.be.undefined;
    });
  });

  describe('peersReady', () => {
    it('Promise case: should call to onPeersReady() without parameters', async () => {
      instance.modules = [{ onPeersReady: promiseStub }];
      await instance.message('peersReady');
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.be.undefined;
    });

    it('Function case: should call to onPeersReady() without parameters', async () => {
      instance.modules = [{ onPeersReady: functionStub }];
      await instance.message('peersReady');
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.be.undefined;
    });
  });

  describe('newBlock', () => {
    it('Promise case: should call to onNewBlock() with the same arguments received from message()', async () => {
      instance.modules = [{ onNewBlock: promiseStub }];
      await instance.message('newBlock', { foo: 'bar' } as any, true);
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.deep.equal({ foo: 'bar' });
      expect(promiseStub.args[0][1]).to.be.true;
    });

    it('Function case: should call to onNewBlock() with the same arguments received from message()', async () => {
      instance.modules = [{ onNewBlock: functionStub }];
      await instance.message('newBlock', { foo: 'bar' } as any, true);
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.deep.equal({ foo: 'bar' });
      expect(functionStub.args[0][1]).to.be.true;
    });
  });

  describe('signature', () => {
    it('Promise case: should call to onSignature() with the same arguments received from message()', async () => {
      instance.modules = [{ onSignature: promiseStub }];
      await instance.message(
        'signature',
        { transaction: 'foo', signature: 123 },
        true
      );
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.deep.equal({
        signature: 123,
        transaction: 'foo',
      });
      expect(promiseStub.args[0][1]).to.be.true;
    });

    it('Function case: should call to onSignature() with the same arguments received from message()', async () => {
      instance.modules = [{ onSignature: functionStub }];
      await instance.message(
        'signature',
        { transaction: 'foo', signature: 123 },
        true
      );
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.deep.equal({
        signature: 123,
        transaction: 'foo',
      });
      expect(functionStub.args[0][1]).to.be.true;
    });
  });

  describe('unconfirmedTransaction', () => {
    it('Promise case: should call to onUnconfirmedTransaction() with the same arguments received from message()', async () => {
      instance.modules = [{ onUnconfirmedTransaction: promiseStub }];
      await instance.message('unconfirmedTransaction', 'abc', true);
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.equal('abc');
      expect(promiseStub.args[0][1]).to.be.true;
    });

    it('Function case: should call to onUnconfirmedTransaction() with the same arguments received from message()', async () => {
      instance.modules = [{ onUnconfirmedTransaction: functionStub }];
      await instance.message('unconfirmedTransaction', 'abc', true);
      expect(functionStub.calledOnce).is.true;
      expect(functionStub.args[0][0]).to.equal('abc');
      expect(functionStub.args[0][1]).to.be.true;
    });
  });

  describe('Testing multiple listeners', () => {
    it('Should call all the listeners in the same order that they were received', async () => {
      instance.modules = [{ onReceiveBlock: promiseStub }, { onReceiveBlock: promiseStub2 }];
      await instance.message('receiveBlock', { the: 'block' } as any);
      expect(promiseStub.calledOnce).is.true;
      expect(promiseStub.args[0][0]).to.be.deep.eq({ the: 'block' });
      expect(promiseStub2.calledOnce).is.true;
      expect(promiseStub2.args[0][0]).to.be.deep.eq({ the: 'block' });
      expect(promiseStub.calledBefore(promiseStub2)).is.true;
      expect(promiseStub2.calledAfter(promiseStub)).is.true;
    });
  });

  describe('Without listeners available', () => {
    it('if the listener doesn\'t exist should not call to others listeners', async () => {
      instance.modules = [
        { onUnconfirmedTransaction: promiseStub },
        { onUnconfirmedTransaction: promiseStub2 },
      ];
      await instance.message('receiveBlock', { the: 'block' } as any);
      expect(promiseStub.called).is.false;
      expect(promiseStub2.called).is.false;
    });
  });
});
