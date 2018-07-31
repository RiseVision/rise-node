import {BaseCoreModule} from '../../src';
import { StubbedInstance } from '../../../core-test-utils/src/stubCreator';
export class Meow extends BaseCoreModule {
  configSchema: any;
  constants: any;
}
export class CoreModuleStub extends StubbedInstance(Meow) {

}