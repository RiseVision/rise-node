// tslint:disable-next-line
import { ILogger } from './index';

export class BlockProgressLogger {
  private target: number;
  private step: number;
  private applied: number = 0;

  constructor(txCount: number, logsFrequency: number, private msg: string, private logger: ILogger) {
    this.target = txCount;
    this.step   = Math.floor(txCount / logsFrequency);

  }

  public reset() {
    this.applied = 0;
  }

  /**
   * Increments applied transactions and logs the progress
   * - For the first and last transaction
   * - With given frequency
   */
  public applyNext() {
    if (this.applied >= this.target) {
      throw new Error('Cannot apply transaction over the limit: ' + this.target);
    }
    this.applied += 1;
    if (this.applied === 1 || this.applied === this.target || this.applied % this.step === 1) {
      this.log();
    }
  }

  /**
   * Logs the progress
   */
  private log() {
    this.logger.info(this.msg, ((this.applied / this.target) * 100).toPrecision(4) + ' %' +
      ': applied ' + this.applied + ' of ' + this.target + ' transactions');
  }
}
