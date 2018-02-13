import { injectable } from 'inversify';
import { IBlocksModuleProcess} from '../../../../src/ioc/interfaces/modules';
import { BasePeerType, SignedAndChainedBlockType, SignedBlockType } from '../../../../src/logic';
import { BaseStubClass } from '../../BaseStubClass';
import { IKeypair } from '../../../../src/helpers';
import { stubMethod } from '../../stubDecorator';
import { IPeerLogic } from '../../../../src/ioc/interfaces/logic';


@injectable()
export class BlocksSubmoduleProcessStub extends BaseStubClass implements IBlocksModuleProcess {
  @stubMethod(true)
  public cleanup(): Promise<void> {
    return Promise.resolve();
  }

  @stubMethod(true)
  public generateBlock(keypair: IKeypair, timestamp: number): Promise<any> {
    return Promise.resolve();
  }

  @stubMethod(true)
  public getCommonBlock(peer: IPeerLogic, height: number): Promise<{ id: string; previousBlock: string; height: number } | void> {
    return Promise.resolve();
  }

  @stubMethod()
  public loadBlocksFromPeer(rawPeer: IPeerLogic | BasePeerType): Promise<SignedBlockType> {
    return undefined;
  }

  @stubMethod()
  public loadBlocksOffset(limit: number, offset: number, verify: boolean): Promise<SignedAndChainedBlockType> {
    return undefined;
  }

  @stubMethod(true)
  public onReceiveBlock(block: SignedBlockType): Promise<any> {
    return Promise.resolve();
  }

}
