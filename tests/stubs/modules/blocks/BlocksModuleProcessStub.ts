import { injectable } from 'inversify';
import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';
import { IBlocksModuleProcess} from "../../../../src/ioc/interfaces/modules";
import {BasePeerType, SignedAndChainedBlockType, SignedBlockType} from "../../../../src/logic";
import {IPeerLogic} from "../../../../src/ioc/interfaces/logic";
import {IKeypair} from "../../../../src/helpers";

@injectable()
export default class BlocksModuleProcessStub extends BaseStubClass implements IBlocksModuleProcess {

    @stubMethod()
    getCommonBlock(peer: IPeerLogic, height: number): Promise<{ id: string; previousBlock: string; height: number } | void> {
        return undefined;
    }

    @stubMethod()
    loadBlocksOffset(limit: number, offset: number, verify: boolean): Promise<SignedAndChainedBlockType> {
        return undefined;
    }

    @stubMethod()
    loadBlocksFromPeer(rawPeer: IPeerLogic | BasePeerType): Promise<SignedBlockType> {
        return undefined;
    }

    @stubMethod()
    generateBlock(keypair: IKeypair, timestamp: number): Promise<any> {
        return undefined;
    }

    @stubMethod()
    onReceiveBlock(block: SignedBlockType): Promise<any> {
        return undefined;
    }

    @stubMethod()
    cleanup(): Promise<void> {
        return undefined;
    }

    // TODO Add more methods when needed
}
