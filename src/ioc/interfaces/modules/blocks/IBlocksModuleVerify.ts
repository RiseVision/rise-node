import { SignedBlockType } from '../../../../logic';
import { IModule } from '../IModule';

export interface IBlocksModuleVerify extends IModule {
  /**
   * Verifies block before fork detection and return all possible errors related to block
   */
  verifyReceipt(block: SignedBlockType): { errors: string[], verified: boolean };

  /**
   * Verify block before processing and return all possible errors related to block
   */
  verifyBlock(block: SignedBlockType): Promise<{ errors: string[], verified: boolean }>;

  processBlock(block: SignedBlockType, broadcast: boolean, saveBlock: boolean): Promise<any>;

}
