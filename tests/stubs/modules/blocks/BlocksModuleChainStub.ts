import { injectable } from 'inversify';
import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';
import {IBlocksModuleChain} from "../../../../src/ioc/interfaces/modules";
import {SignedAndChainedBlockType, SignedBlockType} from "../../../../src/logic";

@injectable()
export default class BlocksModuleChain extends BaseStubClass implements IBlocksModuleChain {

    @stubMethod()
    deleteBlock(blockId: string): Promise<void> {
        return undefined;
    }

    @stubMethod()
    deleteLastBlock(): Promise<SignedAndChainedBlockType> {
        return undefined;
    }

    @stubMethod()
    deleteAfterBlock(blockId: string): Promise<void> {
        return undefined;
    }

    @stubMethod()
    recoverChain(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    saveGenesisBlock(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    applyGenesisBlock(block: SignedAndChainedBlockType): Promise<void> {
        return undefined;
    }

    @stubMethod()
    applyBlock(block: SignedAndChainedBlockType, broadcast: boolean, saveBlock: boolean): Promise<void> {
        return undefined;
    }

    @stubMethod()
    saveBlock(b: SignedBlockType): Promise<void> {
        return undefined;
    }

    @stubMethod()
    cleanup(): Promise<void> {
        return undefined;
    }


    // TODO Add more methods when needed
}
