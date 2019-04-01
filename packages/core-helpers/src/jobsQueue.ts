import { IJobsQueue } from '@risevision/core-types';
import { injectable } from 'inversify';

@injectable()
export class JobsQueue implements IJobsQueue {
  public jobs: { [k: string]: NodeJS.Timer } = {};

  public register(name: string, job: () => Promise<any>, time: number) {
    if (this.jobs[name]) {
      throw new Error('Synchronous job ' + name + ' already registered');
    }

    // require('fs').writeSync(1, `registering ${name}\n`);
    const nextJob = async () => {
      await job();
      // If it was not cancelled. Lets reschedule it.
      if (typeof this.jobs[name] !== 'undefined') {
        this.jobs[name] = setTimeout(nextJob, time);
      }
    };
    this.jobs[name] = setTimeout(nextJob, time);
    return this.jobs[name];
  }

  public unregister(name: string) {
    clearTimeout(this.jobs[name]);
    delete this.jobs[name];
  }

  public unregisterAll() {
    Object.keys(this.jobs).forEach((n) => this.unregister(n));
  }
}
