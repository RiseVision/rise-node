import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';

export const stubMetadataSymbol = Symbol('stubs');

export class BaseStubClass {
  public stubs: { [method: string]: SinonStub };
  public sandbox: SinonSandbox = sinon.sandbox.create();

  private nextResponses: { [method: string]: any[] } = {};
  private methods: string[];

  constructor() {
    this.methods = Reflect.getMetadata(stubMetadataSymbol, this);
    if (!Array.isArray(this.methods) || this.methods.length === 0) {
      throw new Error('no methods defined in stubclass');
    }
    this.stubs   = this.stubs || {};
    this.sandbox = sinon.sandbox.create();
    for (const method of this.methods) {
      this.stubs[method] = this.sandbox.stub(this, method as any);
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
    this.sandbox.reset();
    for (const method of this.methods) {
      this.stubs[method].callsFake(() => {
        if (!Array.isArray(this.nextResponses[method]) || this.nextResponses[method].length === 0) {
          throw new Error(`Please enqueue a response for ${method}`);
        }
        return this.nextResponses[method].shift();
      });
    }
  }
}
