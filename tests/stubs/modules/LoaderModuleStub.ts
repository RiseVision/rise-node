import { injectable } from 'inversify';
import { IPeerLogic } from '../../../src/ioc/interfaces/logic';
import { ILoaderModule } from '../../../src/ioc/interfaces/modules';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class LoaderModuleStub extends BaseStubClass implements ILoaderModule {
  public isSyncing: boolean;
  public loaded: boolean;

  @stubMethod()
  public getNetwork(): Promise<{ height: number; peers: IPeerLogic[] }> {
    return undefined;
  }

  @stubMethod()
  public getRandomPeer(): Promise<IPeerLogic> {
    return undefined;
  }

  @stubMethod()
  public cleanup(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public loadBlockChain(): Promise<void> {
    return;
  }

  @stubMethod()
  public load(count: number, limitPerIteration: number, message?: string): Promise<void> {
    return undefined;
  }
}
