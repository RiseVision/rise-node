import { injectable } from 'inversify';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';

export const stubMetadataSymbol = Symbol('stubs');
export const spyMetadataSymbol  = Symbol('spies');

@injectable()
export class BaseStubClass {
  public stubs: { [method: string]: SinonStub };
  public spies: { [method: string]: SinonSpy };
  public sandbox: SinonSandbox = sinon.sandbox.create();

  private nextResponses: { [method: string]: any[] } = {};
  private stubConfigs: Array<{ method: string, withDefaultAllowed: boolean }>;
  private spyMethods: string[];

  private oldImplementations: { [k: string]: () => {} } = {};

  constructor() {
    this.stubConfigs = Reflect.getMetadata(stubMetadataSymbol, this);
    this.spyMethods  = Reflect.getMetadata(spyMetadataSymbol, this);
    if (!Array.isArray(this.stubConfigs) || this.stubConfigs.length === 0) {
      throw new Error('no methods defined in stubclass');
    }
    if (!Array.isArray(this.spyMethods)) {
      this.spyMethods = [];
    }

    this.reset();
  }

  /**
   * Enqueue a new response for a stubbed method
   * @return {number} the number of enqueued responses.
   */
  public enqueueResponse(method: keyof this, what: any): number {
    if (!Array.isArray(this.nextResponses[method])) {
      this.nextResponses[method] = [];
    }

    return this.nextResponses[method].push(what);
  }

  public reset() {
    this.nextResponses = {};
    this.sandbox.restore();
    this.stubs   = this.stubs || {};
    this.spies   = this.spies || {};
    this.sandbox = sinon.sandbox.create();
    for (const c of this.stubConfigs) {
      this.oldImplementations[c.method] = this[c.method];
      this.stubs[c.method] = this.sandbox.stub(this, c.method as any);
    }

    for (const method of this.spyMethods) {
      this.oldImplementations[method] = this[method];
      this.spies[method] = this.sandbox.spy(this, method as any);
    }

    for (const c of this.stubConfigs) {
      this.stubs[c.method].callsFake((...args) => {
        if (!Array.isArray(this.nextResponses[c.method]) || this.nextResponses[c.method].length === 0) {
          if (c.withDefaultAllowed) {
            return this.oldImplementations[c.method].apply(this, args);
          }
          throw new Error(`Please enqueue a response for ${this.constructor.name}.${c.method}`);
        }
        return this.nextResponses[c.method].shift();
      });
    }
  }
}
