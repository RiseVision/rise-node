import {injectable} from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class MigratorStub extends BaseStubClass {
  @stubMethod(true)
  public async init(): Promise<void> {
    return null;
  }
}
