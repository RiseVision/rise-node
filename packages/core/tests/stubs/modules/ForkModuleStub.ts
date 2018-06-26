import { BaseStubClass } from '../BaseStubClass';
import { IForkModule } from '../../../src/ioc/interfaces/modules';
import { SignedBlockType } from '../../../src/logic';
import { ForkType } from '../../../src/helpers';
import { stubMethod } from '../stubDecorator';

export class ForkModuleStub extends BaseStubClass implements IForkModule {
  @stubMethod(true)
  public fork(block: SignedBlockType, cause: ForkType): Promise<void> {
    return Promise.resolve();
  }
}
