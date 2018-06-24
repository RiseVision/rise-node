import { injectable } from 'inversify';
import { IJobsQueue } from '../ioc/interfaces/helpers';

/**
 * Contains a queue of jobs
 */
@injectable()
export class JobsQueue implements IJobsQueue {
  public jobs: { [k: string]: NodeJS.Timer } = {};

  /**
   * Add a new job to the queue
   */
  public register(name: string, job: () => Promise<any>, time: number) {
    if (this.jobs[name]) {
      throw new Error('Synchronous job ' + name + ' already registered');
    }

    const nextJob = async () => {
      await job();
      this.jobs[name] = setTimeout(nextJob, time);
    };

    this.jobs[name] = setImmediate(nextJob);
    return this.jobs[name];
  }
}
