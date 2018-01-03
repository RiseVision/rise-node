import * as sinon from 'sinon';

export default class ZSchemaStub {
  public stubConfig: {
    validate: {return: boolean}
  };

  public stubs;

  constructor() {
    this.stubReset();
  }

  public stubReset() {
    this.stubs = {
      validate: sinon.stub(),
    };
    this.stubConfig = {
      validate: {
        return: true,
      },
    };
  }

  /**
   * Stubbed methods begin here
   */
  public validate(...args) {
    this.stubs.validate.apply(this, args);
    return this.stubConfig.validate.return;
  }
}
