import 'reflect-metadata';
import { IJobsQueue } from '@risevision/core-interfaces';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JobsQueue } from '../../src';

const waitingPromise = (msToWait: number): Promise<void> => {
  return new Promise<void>((resolve) => setTimeout(resolve, msToWait));
};

describe('helpers/jobsQueue', () => {
  let jobsQueue: IJobsQueue;
  // before(() => tearDownContainer());
  // after(() => createContainer([]));
  beforeEach(() => { jobsQueue = new JobsQueue(); });

  describe('register', () => {

    it('should return the non-null reference of setImmediate / setTimeout for this job', () => {
      const retVal = jobsQueue.register('test1', () => waitingPromise(10), 1000000);
      // tslint:disable no-unused-expression
      expect(retVal).to.be.not.null;
    });

    it('should throw an error when a job with the same name is already registered', () => {
      jobsQueue.register('test2', () => waitingPromise(10), 1000000);
      expect(() => {
        jobsQueue.register('test2', () => waitingPromise(10), 1000000);
      }).to.throw(Error, /already/);
    });

    it('should run the job again after [time] milliseconds after the execution of the job', async () => {
      const job = async () => {
        await waitingPromise(50);
      };
      const spy = sinon.spy(job);
      // This job runs 5ms, and needs to be re-executed after 5 ms
      jobsQueue.register('test3', spy, 50);
      // Wait 200ms: we expect it to be run at least 2 times:
      // 50ms ( duration of first call of job() ) + 50ms (timeout) + 50ms (duration of second call of job) = 150
      await waitingPromise(180);
      expect(spy.callCount).to.be.greaterThan(1);
      // Double check for impossible condition (if it ran 4 times, we have an issue)
      expect(spy.callCount).to.be.below(3);
    });

    it('two or more "instances" of the same job should never be running at the same time', async () => {
      const spy = sinon.spy();
      let jobIsRunning = false;
      let runCount = 0;
      const job = () => {
        return new Promise((resolve) => {
          runCount++;
          if (jobIsRunning) {
            spy();
          }
          jobIsRunning = true;
          setTimeout(() => {
            jobIsRunning = false;
            resolve();
          }, 50);
        });
      };
      // This job runs 5ms, and needs to be executed every 5 ms
      jobsQueue.register('test4', job, 5);
      // Wait some cycles.
      await waitingPromise(1000);
      expect(spy.called).to.be.false;
      // Ensure it ran more than once
      expect(runCount).to.be.greaterThan(1);
      console.log(runCount);
    });

  });

});
