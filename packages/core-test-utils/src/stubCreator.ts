import * as sinon from 'sinon';
import { SinonSpy, SinonStub } from 'sinon';

export interface ISpiedInstance {
  spies: { [T in keyof this]: SinonSpy };
}

export function SpiedInstance<T extends { new(...args: any[]): {} }>(constructor: T) {
  return class __SpiedInstance__ extends constructor implements ISpiedInstance {
    public spies: { [X in keyof this]: SinonSpy } = {} as any;
    public sandbox = sinon.createSandbox();
    constructor(...args) {
      super(...args);
      let ended = false;
      let proto = Object.getPrototypeOf(this);
      while (!ended) {
        if (proto.constructor.name === '__SpiedInstance__') {
          proto = Object.getPrototypeOf(proto);
          continue;
        }
        Object.getOwnPropertyNames(proto)
          .filter((pn) => pn !== 'constructor')
          .filter((pn) => !this.spies[pn])
          .forEach((pn) => this.spies[pn] = this.sandbox.spy(this, pn as any));

        proto = Object.getPrototypeOf(proto);
        ended = proto.constructor.name === 'Object';
      }
    }
  };
}

export interface IStubbedInstance<X> {
  stubs: { [T in keyof X]: SinonStub };
}

export function StubbedInstance<T extends { new(...args: any[]): any }>(Base: T) {
  return class __StubbedInstance__ extends Base implements IStubbedInstance<InstanceType<T>> {
    public stubs: { [Y in keyof InstanceType<T>]: SinonStub } = {} as any;
    public sandbox = sinon.createSandbox();
    constructor(...args) {
      super(...args);
      let ended = false;
      let proto = Object.getPrototypeOf(this);
      while (!ended) {
        if (proto.constructor.name === '__StubbedInstance__') {
          proto = Object.getPrototypeOf(proto);
          continue;
        }
        Object.getOwnPropertyNames(proto)
          .filter((pn) => pn !== 'constructor')
          .filter((pn) => !this.stubs[pn])
          .forEach((pn) => this.stubs[pn] = this.sandbox.stub(this, pn));

        proto = Object.getPrototypeOf(proto);
        ended = proto.constructor.name === 'Object';
      }
    }

  };
}
