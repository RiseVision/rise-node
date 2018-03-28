
interface IPromiseTask {
  worker(): Promise<any>;
}

/**
 * Creates a FIFO sequence array and default settings with config values.
 * Calls __tick with 3
 */
export class Sequence {
  private sequence: IPromiseTask[] = [];
  private config: {
    onWarning: (curPending: number, warnLimit: number) => void,
    warningLimit: number
  };

  constructor(cfg) {
    this.config = {
      ...{
        onWarning   : null,
        warningLimit: 50,
      },
      ...cfg,
    };

    setImmediate(() => this.nextSequenceTick());
  }

  /**
   * Tasks in pending
   */
  public count() {
    return this.sequence.length;
  }

  public addAndPromise<T>(worker: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: IPromiseTask = {
        worker() {
          return worker()
            .then(resolve)
            .catch(reject);
        },
      };
      this.sequence.push(task);
    });
  }

  private tick(cb) {
    const task: IPromiseTask = this.sequence.shift();
    if (!task) {
      return setImmediate(cb);
    }
    return task.worker()
      .then(() => cb());
  }

  private nextSequenceTick() {
    if (this.config.onWarning && this.sequence.length >= this.config.warningLimit) {
      this.config.onWarning(this.sequence.length, this.config.warningLimit);
    }
    this.tick(() => setTimeout(() => this.nextSequenceTick(), 3));
  }
}
