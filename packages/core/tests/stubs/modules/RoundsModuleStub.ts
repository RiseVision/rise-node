import { injectable } from 'inversify';
import { IRoundsModule } from '../../../src/ioc/interfaces/modules';
import { SignedBlockType } from '../../../src/logic';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class RoundsModuleStub extends BaseStubClass implements IRoundsModule {
  @stubMethod()
  public flush(round: number): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public backwardTick(block: SignedBlockType, previousBlock: SignedBlockType): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public tick(block: SignedBlockType): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public cleanup(): Promise<void> {
    return undefined;
  }

}
