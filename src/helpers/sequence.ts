import * as cls from 'cls-hooked';

interface IPromiseTask {
  worker(): Promise<any>;
}

/**
 * Creates a FIFO sequence array and default settings with config values.
 * Calls __tick with 3
 */
export class Sequence {
  private sequence: IPromiseTask[] = [];
  private namespace: any;
  private config: {
    onWarning: (curPending: number, warnLimit: number) => void,
    warningLimit: number
  };

  constructor(private tag: symbol, cfg) {
    this.config = {
      ...{
        onWarning   : null,
        warningLimit: 50,
      },
      ...cfg,
    };

    this.namespace = cls.createNamespace(this.tag);
    this.namespace.run(() => {
      setImmediate(() => this.nextSequenceTick());
    });

  }

  /**
   * Tasks in pending
   */
  public count() {
    return this.sequence.length;
  }

  public addAndPromise<T>(worker: () => Promise<T>): Promise<T> {
    if (this.namespace.get('running') === true) {
      throw new Error(`Sequences conflict!! ${this.tag.toString()}`);
    }
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
    this.namespace.set('running', true);
    task.worker()
      .then(() => {
        this.namespace.set('running', false);
        cb();
      });
  }

  private nextSequenceTick() {
    if (this.config.onWarning && this.sequence.length >= this.config.warningLimit) {
      this.config.onWarning(this.sequence.length, this.config.warningLimit);
    }
    this.tick(() => setTimeout(() => this.nextSequenceTick(), 3));
  }
}
