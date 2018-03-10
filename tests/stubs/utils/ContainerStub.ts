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

  public whenTargetTagged(tag, value) {
    this.binding.whenTargetTagged = [tag, value];
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

  public toConstructor(constructor: any): FakeBindingInWhenOnSyntax {
    this.binding.toConstructor = constructor.name;
    return new FakeBindingInWhenOnSyntax(this.binding);
  }

  public toConstantValue(value: any): FakeBindingInWhenOnSyntax {
    this.binding.toConstantValue = value;
    return new FakeBindingInWhenOnSyntax(this.binding);
  }

  public toFactory(fn: any): FakeBindingInWhenOnSyntax {
    this.binding.toFactory = fn;
    return new FakeBindingInWhenOnSyntax(this.binding);
  }
}

export class ContainerStub {
  public bindings = {};
  public bindCount = 0;
  public get: SinonStub;
  public symbolSymbol = Symbol('constainerStub.binding.symbol')
  private sandbox;

  constructor(sandbox: SinonSandbox) {
    this.sandbox = sandbox;
    this.get = this.sandbox.stub();
  }

  public bind(s: symbol, rebind = false): FakeBindingToSyntax {
    this.bindCount++;
    if (!this.bindings[s]) {
      this.bindings[s] = [];
    }
    const binding: any = {};
    if (rebind) {
      binding.rebind = true;
    }
    binding[this.symbolSymbol] = s;
    this.bindings[s].push(binding);
    return new FakeBindingToSyntax(binding);
  }

  public rebind(s: symbol) {
    return this.bind(s, true);
  }

  public reset() {
    this.bindings = {};
  }
}
