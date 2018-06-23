import { injectable } from 'inversify';
import * as sinon from 'sinon';

@injectable()
export default class PeerLogicStub {
  public stubConfig: {
    accept: {
      return: any
    },
    update: {
      return: any
    },
    makeRequest: {
      return: any
    }
  };

  public stubs;

  // original public properties
  public ip: string;
  public port: number;
  public state: number;
  public os: string;
  public version: string;
  public dappid: string | string[];
  public broadhash: string;
  public height: number;
  public clock: number;
  public updated: number;
  public nonce: string;
  public string: string;

  public defaults = {
    ip       : '127.0.0.1',
    port     : 5566,
    state    : 2,
    os       : 'ubuntu',
    version  : '0.1.10',
    dappid   : '',
    broadhash: '2v1e4343b2847235235',
    height   : 123123412,
    clock    : 54321,
    updated  : 54320,
    nonce    : 'e4343b284',
    string   : 'testPeer',
  };

  constructor() {
    Object.keys(this.defaults).forEach((k) => {
      this[k] = this.defaults[k];
    });
    this.stubReset();
  }

  public stubReset() {
    this.stubs      = {
      accept: sinon.stub(),
      makeRequest: sinon.stub(),
      update: sinon.stub(),
    };
    this.stubConfig = {
      accept: { return: {}, },
      makeRequest: { return: {body: 'stubbedResponse'}, },
      update: { return: this, },
    };
  }

  /**
   * Stubbed methods begin here
   */

  public accept(...args) {
    this.stubs.accept.apply(this, args);
    return this.stubConfig.accept.return;
  }

  public update(...args) {
    this.stubs.update.apply(this, args);
    return this.stubConfig.update.return;
  }

  public makeRequest(...args) {
    this.stubs.makeRequest.apply(this, args);
    return this.stubConfig.makeRequest.return;
  }
}
