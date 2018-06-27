import { injectable } from 'inversify';
import * as sinon from 'sinon';

@injectable()
export default class RedisClientStub {

  public connected: boolean;
  public stubs;

  constructor() {
    this.connected = true;
    this.stubReset();
  }

  public stubReset() {
    this.stubs = {
      get    : sinon.stub(),
      set    : sinon.stub(),
      del    : sinon.stub(),
      scan   : sinon.stub(),
      flushdb: sinon.stub(),
      quit   : sinon.stub(),
    };
  }

  public get(...args) {
    this.stubMethod('get', args);
  }

  public set(...args) {
    this.stubMethod('set', args);
  }

  public del(...args) {
    this.stubMethod('del', args);
  }

  public scan(...args) {
    this.stubMethod('scan', args);
  }

  public flushdb(...args) {
    this.stubMethod('flushdb', args);
  }

  public quit(...args) {
    this.stubMethod('quit', args);
  }

  private stubMethod(name: string, args: any[]) {
    this.stubs[name].apply(this, args);
  }
}
