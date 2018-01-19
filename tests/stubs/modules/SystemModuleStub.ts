import * as sinon from 'sinon';

export default class SystemModuleStub {
  public stubConfig: {
    getNonce: {
      return: any
    }
  };

  public stubs;

  constructor() {
    this.stubReset();
  }

  public stubReset() {
    this.stubs = {
      getNonce: sinon.stub(),
    };
    this.stubConfig = {
      getNonce: {return: {}, },
    };
  }

  /**
   * Stubbed methods begin here
   */

  public getNonce(...args) {
    this.stubs.getNonce.apply(this, args);
    return this.stubConfig.getNonce.return;
  }

}
