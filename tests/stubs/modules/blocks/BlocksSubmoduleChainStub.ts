import { injectable } from 'inversify';
import { IBlocksModuleChain} from '../../../../src/ioc/interfaces/modules';
import { SignedAndChainedBlockType, SignedBlockType } from '../../../../src/logic';
import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';

@injectable()
export class BlocksSubmoduleChainStub extends BaseStubClass implements IBlocksModuleChain {
  @stubMethod()
  public applyBlock(block: SignedAndChainedBlockType, broadcast: boolean, saveBlock: boolean): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public applyGenesisBlock(block: SignedAndChainedBlockType): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public cleanup(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public deleteAfterBlock(blockId: string): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public deleteBlock(blockId: string): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public deleteLastBlock(): Promise<SignedAndChainedBlockType> {
    return undefined;
  }

  @stubMethod()
  public recoverChain(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public saveBlock(b: SignedBlockType): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public saveGenesisBlock(): Promise<void> {
    return undefined;
  }

}
