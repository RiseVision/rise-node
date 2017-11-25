interface ITask {
  isPromise: false;
  args: any[];

  worker(...args: any[]): void;

  worker(...args: any[]): Promise<any>;

  done(err: Error, res: any): void;
}

interface IPromiseTask {
  isPromise: true;

  worker(): Promise<any>;
}

/**
 * Creates a FIFO sequence array and default settings with config values.
 * Calls __tick with 3
 */
export class Sequence {
  private sequence: Array<ITask | IPromiseTask> = [];
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
        isPromise: true,
        worker() {
          return worker()
            .then(resolve)
            .catch(reject);
        },
      };
      this.sequence.push(task);
    });

  }

  public add(worker, args?: any[] | ((err: Error, res: any) => void), done?: (err: Error, res: any) => void) {
    if (!done && args && typeof(args) === 'function') {
      done = args;
      args = undefined;
    }
    if (worker && typeof(worker) === 'function') {
      const task: ITask = { isPromise: false, worker, done, args: null };
      if (Array.isArray(args)) {
        task.args = args;
      }
      this.sequence.push(task);
    }
  }

  private tick(cb) {
    const task: ITask|IPromiseTask = this.sequence.shift();
    if (!task) {
      return setImmediate(cb);
    }
    if (task.isPromise === true) {
      return task.worker()
        .then((res) => cb())
        .catch((err) => cb());
    } else {
      let args = [(err, res) => {
        if (task.done) {
          setImmediate(task.done, err, res);
        }
        setImmediate(cb);
      }];
      if (task.args) {
        args = args.concat(task.args);
      }
      task.worker.apply(task.worker, args);
    }
  }

  private nextSequenceTick() {
    if (this.config.onWarning && this.sequence.length >= this.config.warningLimit) {
      this.config.onWarning(this.sequence.length, this.config.warningLimit);
    }
    this.tick(() => setTimeout(() => this.nextSequenceTick(), 3));
  }
}
