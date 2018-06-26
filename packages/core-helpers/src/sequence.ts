import * as cls from 'cls-hooked';
import { Namespace } from 'continuation-local-storage';

interface IPromiseTask {
  worker(): Promise<any>;
}

/**
 * Creates a FIFO sequence array and default settings with config values.
 */
export class Sequence {
  private sequence: IPromiseTask[] = [];
  private namespace: Namespace;
  private config: {
    onWarning: (curPending: number, warnLimit: number) => void,
    warningLimit: number
  };
  private running: boolean         = false;

  constructor(private tag: symbol, cfg) {
    this.config = {
      ...{
        onWarning   : null,
        warningLimit: 50,
      },
      ...cfg,
    };

    this.namespace = cls.createNamespace(this.tag);
  }

  /**
   * Tasks in pending
   */
  public count() {
    return this.sequence.length;
  }

  public addAndPromise<T>(worker: () => Promise<T>): Promise<T> {
    if (this.namespace.get('running') === true) {
      // console.log('PREVIOUSLY: ',this.namespace.get('stack'));
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
      if (!this.running) {
        setImmediate(() => this.tick());
      }
    });
  }

  private tick() {
    // console.log('tick', this.running);
    if (this.running) {
      return;
    }
    this.running = true;
    this.namespace.run(async () => {
      if (this.config.onWarning && this.sequence.length >= this.config.warningLimit) {
        this.config.onWarning(this.sequence.length, this.config.warningLimit);
      }
      this.namespace.set('running', true);
      const totalTasks = this.sequence.length;

      for (let i = 0; i < totalTasks; i++) {
        const task: IPromiseTask = this.sequence.shift();
        try {
          await task.worker();
        } catch (e) {
          // unreachable code?
        }
      }
      this.namespace.set('running', false);
      this.running = false;
      if (this.sequence.length > 0) {
        this.tick();
      }
    });
  }

}
