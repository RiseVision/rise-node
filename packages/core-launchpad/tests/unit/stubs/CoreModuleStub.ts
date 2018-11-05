import { StubbedInstance } from '../../../../core-utils/tests/unit/stubs';
import { BaseCoreModule } from '../../../src';
// tslint:disable max-classes-per-file
export class Meow extends BaseCoreModule {
  public configSchema: any;
  public constants: any;
}

export class CoreModuleStub extends StubbedInstance(Meow) {}
