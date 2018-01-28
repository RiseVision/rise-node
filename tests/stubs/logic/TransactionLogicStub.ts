import * as sinon from 'sinon';

export default class TransactionLogicStub {
  public stubConfig: {
    getBytes: {
      return: any
    },
    objectNormalize: {
      return: any
    },
    process: {
      resolve: boolean,
      return: any
    },
    verify: {
      resolve: boolean,
      return: any
    },
  };

  public stubs;

  constructor() {
    this.stubReset();
  }

  public stubReset() {
    this.stubs = {
      getBytes: sinon.stub(),
      objectNormalize: sinon.stub(),
      process: sinon.stub(),
      verify: sinon.stub(),
    };
    this.stubConfig = {
      getBytes:   {return: null },
      objectNormalize: {return: null },
      process: {return: null, resolve: true },
      verify: {return: null, resolve: true },
    };
  }

  /**
   * Stubbed methods begin here
   */

  public getBytes(...args) {
    this.stubs.getBytes.apply(this, args);
    return this.stubConfig.getBytes.return;
  }

  public objectNormalize(...args) {
    this.stubs.objectNormalize.apply(this, args);
    return this.stubConfig.objectNormalize.return;
  }

  public process(...args) {
    this.stubs.process.apply(this, args);
    if (this.stubConfig.process.resolve) {
      return Promise.resolve(this.stubConfig.process.return);
    } else {
      return Promise.reject(this.stubConfig.process.return);
    }
  }

  public verify(...args) {
    this.stubs.verify.apply(this, args);
    if (this.stubConfig.verify.resolve) {
      return Promise.resolve(this.stubConfig.verify.return);
    } else {
      return Promise.reject(this.stubConfig.verify.return);
    }
  }

  // TODO rewrite with decorators.
  // TODO stub all methods
}
