import {injectable} from 'inversify';
import {BaseStubClass} from '../../BaseStubClass';
import {stubMethod} from '../../stubDecorator';
import {IBlocksModuleVerify} from "../../../../src/ioc/interfaces/modules";
import {SignedBlockType} from "../../../../src/logic";

@injectable()
export default class BlocksModuleVerifyStub extends BaseStubClass implements IBlocksModuleVerify {
    @stubMethod()
    verifyReceipt(block: SignedBlockType): { errors: string[]; verified: boolean } {
        return undefined;
    }

    @stubMethod()
    verifyBlock(block: SignedBlockType): Promise<{ errors: string[]; verified: boolean }> {
        return undefined;
    }

    @stubMethod()
    processBlock(block: SignedBlockType, broadcast: boolean, saveBlock: boolean): Promise<any> {
        return undefined;
    }

    @stubMethod()
    cleanup(): Promise<void> {
        return undefined;
    }

    // TODO Add more methods when needed
}
