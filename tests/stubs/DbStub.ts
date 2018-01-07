import * as sinon from 'sinon';

export default class DbStub {
  public stubConfig: {
    query: {
      resolve: boolean,
      return: any
    },
    none: {
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
      query: sinon.stub(),
      none: sinon.stub(),
    };
    this.stubConfig = {
      query: {
        resolve: true,
        return: null,
      },
      none: {
        resolve: true,
        return: null,
      },
    };
  }

  /**
   * Stubbed methods begin here
   */
  public query(...args) {
    this.stubs.query.apply(this, args);
    if (this.stubConfig.query.resolve) {
      return Promise.resolve(this.stubConfig.query.return);
    } else {
      return Promise.reject(this.stubConfig.query.return);
    }
  }

  public none(...args) {
    this.stubs.none.apply(this, args);
    if (this.stubConfig.none.resolve) {
      return Promise.resolve(this.stubConfig.none.return);
    } else {
      return Promise.reject(this.stubConfig.none.return);
    }
  }

  // TODO Add more methods when needed
}
