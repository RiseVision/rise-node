import { IForgeModule } from '@risevision/core-interfaces';
import { IKeypair, publicKey } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class ForgeModuleStub extends BaseStubClass implements IForgeModule {
  @stubMethod()
  public disableForge(pk?: publicKey): void {
    return void 0;
  }

  @stubMethod()
  public enableForge(kp?: IKeypair): void {
    return void 0;
  }

  @stubMethod()
  public getEnabledKeys(): publicKey[] {
    return undefined;
  }

  @stubMethod()
  public isForgeEnabledOn(pk?: publicKey | IKeypair): boolean {
    return false;
  }
}
