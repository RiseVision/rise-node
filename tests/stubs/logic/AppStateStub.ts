import { IAppState } from '../../../src/ioc/interfaces/logic';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

export class AppStateStub extends BaseStubClass implements IAppState {

  @stubMethod()
  public get(what: any): any {
    return undefined;
  }

  @stubMethod()
  public getComputed(what): boolean {
    return false;
  }

  @stubMethod()
  public set(what: string, value: boolean | number) {
    return void 0;
  }

  @stubMethod()
  public setComputed(what, fn: (as: IAppState) => boolean) {
    return void 0;
  }

}
