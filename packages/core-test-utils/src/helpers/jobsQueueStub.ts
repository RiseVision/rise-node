import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class JobsQueueStub extends BaseStubClass /*implements IDatabase<any>*/ {

  @stubMethod(true)
  public register(name: string, job: () => Promise<any>, time: number): any {
    return [name, time];
  }
}
