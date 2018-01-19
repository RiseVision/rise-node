import {injectable} from 'inversify';
import * as sinon from 'sinon';

@injectable()
export default class LoggerStub {
  public stubs;

  constructor() {
    this.stubReset();
  }

  public stubReset() {
    this.stubs = {
      none: sinon.stub(),
      trace: sinon.stub(),
      debug: sinon.stub(),
      log: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      fatal: sinon.stub(),
      setLevel: sinon.stub(),
    };
  }

  /**
   * Stubbed methods begin here
   */
  public none(...args) {
    this.stubMethod('none', args);
  }
  public trace(...args) {
    this.stubMethod('trace', args);
  }
  public debug(...args) {
    this.stubMethod('debug', args);
  }
  public log(...args) {
    this.stubMethod('log', args);
  }
  public info(...args) {
    this.stubMethod('info', args);
  }
  public warn(...args) {
    this.stubMethod('warn', args);
  }
  public error(...args) {
    this.stubMethod('error', args);
  }
  public fatal(...args) {
    this.stubMethod('fatal', args);
  }
  public setLevel(...args) {
    this.stubMethod('setLevel', args);
  }

  private stubMethod(name: string, args: any[]) {
    this.stubs[name].apply(this, args);
  }
}