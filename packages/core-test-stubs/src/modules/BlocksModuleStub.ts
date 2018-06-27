import { IBlocksModel, IBlocksModule } from '@risevision/core-interfaces';
import { injectable } from 'inversify';
import { SinonSandbox, SinonSpy } from 'sinon';

@injectable()
export default class BlocksModuleStub implements IBlocksModule {
  public lastReceipt: { get: () => number; isStale: () => boolean; update: (time?: number) => void };
  public lastBlock: IBlocksModel;
  public isActive: boolean;
  public isCleaning: boolean;

  public spies: {
    lastReceipt: {
      get: SinonSpy,
      isStale: SinonSpy,
      update: SinonSpy,
    }
  };
  public sandbox: SinonSandbox;

  constructor() {
    this.lastReceipt = {
      get() {
        return null;
      },
      isStale() {
        return null;
      },
      update() {
        return null;
      },
    };
    this.spies       = {
      lastReceipt: {
        get    : this.sandbox.spy(this.lastReceipt, 'get'),
        isStale: this.sandbox.spy(this.lastReceipt, 'isStale'),
        update : this.sandbox.spy(this.lastReceipt, 'update'),
      },
    };
  }

  public cleanup(): Promise<void> {
    return undefined;
  }

}
