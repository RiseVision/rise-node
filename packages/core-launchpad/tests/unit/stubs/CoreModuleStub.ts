import { BaseCoreModule } from '../../../src';
import { StubbedInstance } from '../../../../core-utils/tests/unit/stubs';

export class Meow extends BaseCoreModule {
  configSchema: any;
  constants: any;
}

export class CoreModuleStub extends StubbedInstance(Meow) {}
