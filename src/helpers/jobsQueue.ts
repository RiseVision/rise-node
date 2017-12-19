export class JobsQueue {
  public static jobs: { [k: string]: NodeJS.Timer } = {};

  public static register(name: string, job: () => Promise<any>, time: number) {
    // TODO: Maybe there is a bug here as this.jobs[name] could be set asynchronously depending by how job is defined
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
