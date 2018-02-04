import * as sinon from 'sinon';
import { injectable } from 'inversify';

@injectable()
export default class TransportModuleStub {
  public stubConfig: {
    getFromPeer: {
      resolve: boolean,
      return: any
    }
  };

  public stubs;

  constructor() {
    this.stubReset();
  }

  public stubReset() {
    this.stubs = {
      getFromPeer: sinon.stub(),
    };
    this.stubConfig = {
      getFromPeer: {
        resolve: true,
        return: {
          body: '',
          peer: {},
        },
      },
    };
  }

  /**
   * Stubbed methods begin here
   */
  public getFromPeer(...args) {
    this.stubs.getFromPeer.apply(this, args);
    if (this.stubConfig.getFromPeer.resolve) {
      return Promise.resolve(this.stubConfig.getFromPeer.return);
    } else {
      return Promise.reject(this.stubConfig.getFromPeer.return);
    }
  }

  // TODO Add more methods when needed
}
