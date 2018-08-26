import { IJobsQueue } from '@risevision/core-interfaces';
import { injectable } from 'inversify';

@injectable()
export class JobsQueue implements IJobsQueue {
  public jobs: { [k: string]: NodeJS.Timer } = {};

  public register(name: string, job: () => Promise<any>, time: number) {
    if (this.jobs[name]) {
      throw new Error('Synchronous job ' + name + ' already registered');
    }

    const nextJob = async () => {
      await job();
      // If it was not cancelled. Lets reschedule it.
      if (typeof(this.jobs[name]) !== 'undefined') {
        this.jobs[name] = setTimeout(nextJob, time);
      }
    };

    this.jobs[name] = setImmediate(nextJob);
    return this.jobs[name];
  }

  public unregister(name: string) {
    try {
      clearTimeout(this.jobs[name]);
    } catch (e) {
      // just registered
      console.log(e);
    }
    delete this.jobs[name];
  }

}
