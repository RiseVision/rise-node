import { IBlocksModel, IBlocksModuleProcess, IPeerLogic } from '@risevision/core-interfaces';
import { BasePeerType, IKeypair, SignedBlockType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';

@injectable()
export class BlocksSubmoduleProcessStub extends BaseStubClass implements IBlocksModuleProcess {
  @stubMethod(true)
  public cleanup(): Promise<void> {
    return Promise.resolve();
  }

  @stubMethod()
  public getCommonBlock(peer: IPeerLogic, height: number): Promise<{ id: string, previousBlock: string, height: number } | void> {
    return null;
  }

  @stubMethod()
  public loadBlocksOffset(limit: number, offset: number, verify: boolean): Promise<IBlocksModel> {
    return null;
  }

  @stubMethod()
  public loadBlocksFromPeer(rawPeer: IPeerLogic | BasePeerType): Promise<SignedBlockType> {
    return null;
  }

  @stubMethod()
  public generateBlock(keypair: IKeypair, timestamp: number): Promise<any> {
    return null;
  }

  @stubMethod()
  public onReceiveBlock(block: SignedBlockType): Promise<any> {
    return null;
  }

}
