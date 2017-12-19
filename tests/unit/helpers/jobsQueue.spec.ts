import { expect } from 'chai';
import * as sinon from 'sinon';
import { JobsQueue } from '../../../src/helpers';

const waitingPromise = (msToWait: number): Promise<void> => {
  return new Promise<void>((resolve) => setTimeout(resolve, msToWait));
};

describe('helpers/jobsQueue', () => {

  describe('register', () => {

    it('should return the non-null reference of setImmediate / setTimeout for this job', () => {
      const retVal = JobsQueue.register('test1', () => waitingPromise(10), 1000000);
      // tslint:disable no-unused-expression
      expect(retVal).to.be.not.null;
    });

    it('should throw an error when a job with the same name is already registered', () => {
      JobsQueue.register('test2', () => waitingPromise(10), 1000000);
      expect(() => {
        JobsQueue.register('test2', () => waitingPromise(10), 1000000);
      }).to.throw(Error, /already/);
    });

    it('should run the job again after [time] milliseconds after the execution of the job', async () => {
      const spy = sinon.spy();
      const job = () => {
        return new Promise((resolve, reject) => {
          spy();
          setTimeout(() => {
            resolve();
          }, 5);
        });
      };
      // This job runs 5ms, and needs to be re-executed after 5 ms
      JobsQueue.register('test3', job, 5);
      // Wait 20ms: we expect it to be run at least 2 times:
      // 5ms ( duration of first call of job() ) + 5ms (timeout) + 5ms (duration of second call of job) = 15
      await waitingPromise(18);
      expect(spy.callCount).to.be.greaterThan(1);
      // Double check for impossible condition (if it ran 4 times, we have an issue)
      expect(spy.callCount).to.be.below(4);
    });

    it('two or more "instances" of the same job should never be running at the same time', async () => {
      const spy = sinon.spy();
      let jobIsRunning = false;
      let runCount = 0;
      const job = () => {
        return new Promise((resolve, reject) => {
          runCount++;
          if (jobIsRunning) {
            spy();
          }
          jobIsRunning = true;
          setTimeout(() => {
            jobIsRunning = false;
            resolve();
          }, 5);
        });
      };
      // This job runs 5ms, and needs to be executed every 5 ms
      JobsQueue.register('test4', job, 5);
      // Wait ar least 2 cycles
      await waitingPromise(25);
      expect(spy.called).to.be.false;
      // Ensure it ran more than once
      expect(runCount).to.be.greaterThan(1);
    });

  });

});
