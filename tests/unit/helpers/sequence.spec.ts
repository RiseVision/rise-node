import {expect} from 'chai';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { Sequence } from '../../../src/helpers/sequence';

const seqConfig = {
  onWarning: (curPending: number, warnLimit: number) => {
    return;
  },
  warningLimit: 4,
};

const getPromiseWorker = (value: string | Error = 'value', doReject = false, ms = 10,  stub?: SinonStub) => {
  return () => new Promise((resolve, reject) => {
    if (doReject) {
      setTimeout(() => {
        if (stub) { stub(); }
        reject(value);
      }, ms);
    } else {
      setTimeout(() => {
        if (stub) { stub(); }
        resolve(value);
      }, ms);
    }
  });
};

describe('helpers/sequence', () => {

  describe('count', () => {

    it('should return zero if no tasks in queue', () => {
      const sequence = new Sequence(seqConfig);
      expect(sequence.count()).to.be.eq(0);
    });

    it('should return 1 before task done 0 after done', async () => {
      const sequence = new Sequence(seqConfig);
      const worker = getPromiseWorker();
      const promise = sequence.addAndPromise(worker);
      expect(sequence.count()).to.be.eq(1);
      await promise;
      expect(sequence.count()).to.be.eq(0);
    });

    it('should return the number of tasks in the sequence', () => {
      const sequence = new Sequence(seqConfig);
      sequence.addAndPromise(getPromiseWorker());
      sequence.addAndPromise(getPromiseWorker());
      expect(sequence.count()).to.be.eq(2);
    });
  });
  describe('addAndPromise', () => {

    it('should return a Promise', () => {
      const sequence = new Sequence(seqConfig);
      const toRet = sequence.addAndPromise(() => Promise.resolve());
      expect(toRet).to.be.instanceOf(Promise);
    });

    it('should resolve the task and return resolved value', async () => {
      const sequence = new Sequence(seqConfig);
      const worker = getPromiseWorker();
      const val = await sequence.addAndPromise(worker);
      expect(val).to.be.eq('value');
    });

    it('should reject the task with the right error if rejects', async () => {
      const sequence = new Sequence(seqConfig);
      const err = new Error('error');
      const worker = getPromiseWorker(err, true);
      await sequence.addAndPromise(worker).catch((reason) => {
        expect(reason).to.be.eq(err);
      });
    });
  });

  describe('tick', () => {
    it('promise fulfillment should make the sequence advance to next task', async () => {
      const sequence = new Sequence(seqConfig);
      const stub = sinon.stub();
      // add two resolving promises
      sequence.addAndPromise(getPromiseWorker('resolve'));
      await sequence.addAndPromise(getPromiseWorker('2', false, 10, stub));
      // tslint:disable no-unused-expression
      expect(stub.called).to.be.true;
    });

    it('promise rejection should make the sequence advance to next task', async () => {
      const sequence = new Sequence(seqConfig);
      const stub = sinon.stub();
      // add a rejecting promise
      sequence.addAndPromise(getPromiseWorker(new Error('rejecting'), true)).catch(() => { return; });
      // add a resolving promise
      await sequence.addAndPromise(getPromiseWorker('resolving', false, 10, stub));
      expect(stub.called).to.be.true;
    });

    it('should preserve order and execute task in FIFO style', async () => {
      const sequence = new Sequence(seqConfig);
      const spy1 = sinon.stub();
      const spy2 = sinon.stub();
      const spy3 = sinon.stub();
      // This resolves in 5ms
      sequence.addAndPromise(getPromiseWorker('1', false, 5, spy1));
      // This resolves in 3ms
      sequence.addAndPromise(getPromiseWorker('2', false, 3, spy2));
      // This resolves in 1ms
      await sequence.addAndPromise(getPromiseWorker('3', false, 1, spy3));
      sinon.assert.callOrder(spy1, spy2, spy3);
    });

    it('tasks should not run simultaneusly', async () => {
      const sequence = new Sequence(seqConfig);
      const failSpy = sinon.spy();
      let runningTask = 0;
      const makeWorker = (index) => {
        return () => {
          if (runningTask !== index - 1) {
            failSpy();
          }
          runningTask = index;
          return Promise.resolve(index);
        };
      };
      sequence.addAndPromise(makeWorker(1));
      sequence.addAndPromise(makeWorker(2));
      await sequence.addAndPromise(makeWorker(3));
      expect(failSpy.called).to.be.false;
      expect(runningTask).to.be.eq(3);
    });

    it('should raise a warning when queued tasks reaches the limit', async () => {
      const onWarningStub = sinon.stub();
      const cfg = {
        onWarning: (curPending: number, warnLimit: number) => {
          onWarningStub();
        },
        warningLimit: 4,
      };
      const sequence = new Sequence(cfg);
      // warningLimit is 4. Add 2 tasks --> No warning
      sequence.addAndPromise(() => Promise.resolve(1));
      await sequence.addAndPromise(() => Promise.resolve(2));
      expect(onWarningStub.called).to.be.false;
      // warningLimit is 4. Add 5 tasks --> Warning!
      sequence.addAndPromise(() => Promise.resolve(1));
      sequence.addAndPromise(() => Promise.resolve(2));
      sequence.addAndPromise(() => Promise.resolve(3));
      sequence.addAndPromise(() => Promise.resolve(4));
      await sequence.addAndPromise(() => Promise.resolve(5));
      expect(onWarningStub.called).to.be.true;
    });

  });

});
