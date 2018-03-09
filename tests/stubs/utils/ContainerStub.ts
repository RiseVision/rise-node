// tslint:disable max-classes-per-file

import { SinonSandbox, SinonStub } from 'sinon';

class FakeBindingInWhenOnSyntax {
  private binding;
  constructor(binding: any) {
    this.binding = binding;
  }

  public inSingletonScope() {
    this.binding.inSingletonScope = true;
  }

  public whenTargetTagged(tag) {
    this.binding.whenTargetTagged = tag;
  }
}

class FakeBindingToSyntax {
  private binding;
  constructor(binding: any) {
    this.binding = binding;
  }

  public to(constructor: any): FakeBindingInWhenOnSyntax {
    this.binding.to = constructor.name;
    return new FakeBindingInWhenOnSyntax(this.binding);
  }

  public toConstantValue(value: any): FakeBindingInWhenOnSyntax {
    this.binding.toConstantValue = value;
    return new FakeBindingInWhenOnSyntax(this.binding);
  }
}

export class ContainerStub {
  public bindings = {};
  public bindCount = 0;
  public get: SinonStub;
  private sandbox;

  constructor(sandbox: SinonSandbox) {
    this.sandbox = sandbox;
    this.get = this.sandbox.stub();
  }

  public bind(s: symbol, method = 'bind'): FakeBindingToSyntax {
    this.bindCount++;
    if (!this.bindings[s]) {
      this.bindings[s] = [];
    }
    const binding = {
      symbol: s.toString(),
      method,
    };
    this.bindings[s].push(binding);
    return new FakeBindingToSyntax(binding);
  }

  public rebind(s: symbol) {
    return this.bind(s, 'rebind');
  }

  public reset() {
    this.bindings = [];
  }
}
