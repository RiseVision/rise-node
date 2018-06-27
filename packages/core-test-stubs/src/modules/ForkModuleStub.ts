import { IForkModule } from '@risevision/core-interfaces';
import { ForkType, SignedBlockType } from '@risevision/core-types';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

export class ForkModuleStub extends BaseStubClass implements IForkModule {
  @stubMethod(true)
  public fork(block: SignedBlockType, cause: ForkType): Promise<void> {
    return Promise.resolve();
  }
}
