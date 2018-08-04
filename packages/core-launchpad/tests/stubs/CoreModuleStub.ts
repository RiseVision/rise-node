import { StubbedInstance } from '../../../core-test-utils/src/stubCreator';
import { BaseCoreModule } from '../../src';

export class Meow extends BaseCoreModule {
  configSchema: any;
  constants: any;
}

export class CoreModuleStub extends StubbedInstance(Meow) {

}
