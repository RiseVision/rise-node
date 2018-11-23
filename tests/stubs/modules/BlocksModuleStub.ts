import { injectable } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import { IBlocksModule } from '../../../src/ioc/interfaces/modules';
import { SignedAndChainedBlockType } from '../../../src/logic';
import { BlocksModule } from '../../../src/modules';
import { BlocksModel } from '../../../src/models';

@injectable()
export default class BlocksModuleStub implements IBlocksModule {
  public lastReceipt: { get: () => number; isStale: () => boolean; update: (time?: number) => void };
  public lastBlock: SignedAndChainedBlockType;
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
    const orig       = new BlocksModule();
    this.lastReceipt = orig.lastReceipt;
    this.sandbox     = sinon.createSandbox();

    this.spies = {
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
