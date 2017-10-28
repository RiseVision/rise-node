interface ITask {
  args: any[];

  worker(...args: any[]): void;

  done(err: Error, res: any): void;
}

/**
 * Creates a FIFO sequence array and default settings with config values.
 * Calls __tick with 3
 */
export default class Sequence {
  private sequence: ITask[] = [];
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

  public add(worker, args?: any[] | ((err: Error, res: any) => void), done?: (err: Error, res: any) => void) {
    if (!done && args && typeof(args) === 'function') {
      done = args;
      args = undefined;
    }
    if (worker && typeof(worker) === 'function') {
      const task: ITask = { worker, done, args: null };
      if (Array.isArray(args)) {
        task.args = args;
      }
      this.sequence.push(task);
    }
  }

  private tick(cb) {
    const task = this.sequence.shift();
    if (!task) {
      return setImmediate(cb);
    }
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

  private nextSequenceTick() {
    if (this.config.onWarning && this.sequence.length >= this.config.warningLimit) {
      this.config.onWarning(this.sequence.length, this.config.warningLimit);
    }
    this.tick(() => setTimeout(() => this.nextSequenceTick(), 3));
  }
}
