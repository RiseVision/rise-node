import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { IRoundsModule } from '@risevision/core-interfaces';
import { SignedBlockType } from '@risevision/core-types';

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
