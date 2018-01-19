export interface IJobsQueue {
  jobs: { [k: string]: NodeJS.Timer };

  register(name: string, job: () => Promise<any>, time: number): NodeJS.Timer;
}
