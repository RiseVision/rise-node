import * as sinon from 'sinon';

export default class TransactionLogicStub {
  public stubConfig: {
    getBytes: {
      return: any
    },
    objectNormalize: {
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
    };
    this.stubConfig = {
      getBytes:   {return: null },
      objectNormalize: {return: null },
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

  // TODO stub all methods
}
