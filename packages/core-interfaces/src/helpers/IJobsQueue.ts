export interface IJobsQueue {
  jobs: { [k: string]: NodeJS.Timer };

  /**
   * Register a recurring job on the queue. The first time the job is invoked is after the specified time.
   * The following executions are scheduled after the job promise resolves, so the time between two invocations
   * might be larger than the requested time if the job takes a while to complete.
   * @param name Name of the job
   * @param job Logic to execute periodically
   * @param time The time between invocations, in milliseconds
   */
  register(name: string, job: () => Promise<any>, time: number): NodeJS.Timer;

  unregister(name: string): void;
}
