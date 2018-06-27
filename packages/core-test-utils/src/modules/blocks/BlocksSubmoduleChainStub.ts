import { IBlocksModuleChain } from '@risevision/core-interfaces';
import { SignedAndChainedBlockType, SignedBlockType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { Transaction } from 'sequelize';
import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';

@injectable()
export class BlocksSubmoduleChainStub extends BaseStubClass implements IBlocksModuleChain {
  @stubMethod()
  public deleteLastBlock(): Promise<SignedAndChainedBlockType> {
    return null;
  }

  @stubMethod()
  public deleteAfterBlock(height: number): Promise<void> {
    return null;
  }

  @stubMethod()
  public recoverChain(): Promise<void> {
    return null;
  }

  @stubMethod()
  public saveGenesisBlock(): Promise<void> {
    return null;
  }

  @stubMethod()
  public applyGenesisBlock(block: SignedAndChainedBlockType): Promise<void> {
    return null;
  }

  @stubMethod()
  public applyBlock(block: SignedAndChainedBlockType, broadcast: boolean, saveBlock: boolean): Promise<void> {
    return null;
  }

  @stubMethod()
  public saveBlock(b: SignedBlockType, dbTX: Transaction): Promise<void> {
    return null;
  }

  @stubMethod()
  public cleanup(): Promise<void> {
    return null;
  }

}
