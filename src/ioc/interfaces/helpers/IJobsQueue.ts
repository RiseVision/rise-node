export interface IJobsQueue {
  jobs: { [k: string]: NodeJS.Timer };

  /**
   * Add a new job to the queue
   */
  register(name: string, job: () => Promise<any>, time: number): NodeJS.Timer;
}
