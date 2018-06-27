import { injectable } from 'inversify';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';

export const stubMetadataSymbol = Symbol('stubs');
export const spyMetadataSymbol  = Symbol('spies');

@injectable()
export class BaseStubClass {
  public static stubs: { [method: string]: SinonStub }         = {};
  public static stubConfigs: Array<{ method: string, withDefaultAllowed: boolean }>;
  private static nextResponses: { [method: string]: any[] }    = {};
  private static sandbox: SinonSandbox                         = sinon.createSandbox();
  private static oldImplementations: { [k: string]: () => {} } = {};

  public stubs: { [T in keyof this]: SinonStub };
  public spies: { [T in keyof this]: SinonSpy };
  public sandbox: SinonSandbox = sinon.createSandbox();

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

  public static enqueueResponse(method: string, what: any): number {
    if (!Array.isArray(this.nextResponses[method])) {
      this.nextResponses[method] = [];
    }
    return this.nextResponses[method].push(what);
  }

  public static reset() {
    this.nextResponses = {};
    this.sandbox.restore();
    this.stubs   = this.stubs || {};
    this.sandbox = sinon.createSandbox();
    for (const c of this.stubConfigs) {
      this.oldImplementations[c.method] = this[c.method];
      this.stubs[c.method]              = this.sandbox.stub(this, c.method as any);
    }
    for (const c of this.stubConfigs) {
      this.stubs[c.method].callsFake((...args) => {
        if (!Array.isArray(this.nextResponses[c.method]) || this.nextResponses[c.method].length === 0) {
          if (c.withDefaultAllowed) {
            return this.oldImplementations[c.method].apply(this, args);
          }
          throw new Error(`Please enqueue a response for ${this.name}.[static]:${c.method}`);
        }
        return this.nextResponses[c.method].shift();
      });
    }
  }

  public reset() {
    this.nextResponses = {};
    this.sandbox.restore();
    this.stubs   = this.stubs || {} as any;
    this.spies   = this.spies || {} as any;
    this.sandbox = sinon.createSandbox();

    for (const c of this.stubConfigs) {
      this.oldImplementations[c.method] = this[c.method];
      this.stubs[c.method]              = this.sandbox.stub(this, c.method as any);
    }

    for (const method of this.spyMethods) {
      this.oldImplementations[method] = this[method];
      this.spies[method]              = this.sandbox.spy(this, method as any);
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
