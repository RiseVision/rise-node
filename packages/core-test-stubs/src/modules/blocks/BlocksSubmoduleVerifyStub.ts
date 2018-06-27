import { IBlocksModuleVerify } from '@risevision/core-interfaces';
import { SignedBlockType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';

@injectable()
export class BlocksSubmoduleVerifyStub extends BaseStubClass implements IBlocksModuleVerify {
  @stubMethod()
  public cleanup(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public processBlock(block: SignedBlockType, broadcast: boolean, saveBlock: boolean): Promise<any> {
    return undefined;
  }

  @stubMethod()
  public verifyBlock(block: SignedBlockType): Promise<{ errors: string[]; verified: boolean }> {
    return undefined;
  }

  @stubMethod()
  public verifyReceipt(block: SignedBlockType): { errors: string[]; verified: boolean } {
    return undefined;
  }

}
