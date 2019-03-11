import { BaseCoreModule } from '@risevision/core-types';
import { StubbedInstance } from '../../../../core-utils/tests/unit/stubs';
// tslint:disable max-classes-per-file
export class Meow extends BaseCoreModule {
  public configSchema: any;
  public constants: any;
}

export class CoreModuleStub extends StubbedInstance(Meow) {}
