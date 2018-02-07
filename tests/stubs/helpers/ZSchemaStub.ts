import { injectable } from 'inversify';
import * as sinon from 'sinon';

@injectable()
export default class ZSchemaStub {
  public stubConfig: {
    validate: {return: any}
    getLastErrors: {return: any}
  };

  public stubs;

  constructor() {
    this.stubReset();
  }

  public stubReset() {
    this.stubs = {
      validate: sinon.stub(),
      getLastErrors: sinon.stub(),
    };
    this.stubConfig = {
      validate: {
        return: true,
      },
      getLastErrors: {
        return: [],
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

  public getLastErrors(...args) {
    this.stubs.getLastErrors.apply(this, args);
    return this.stubConfig.getLastErrors.return;
  }
}
