import {injectable} from 'inversify';
import {BaseStubClass} from '../../BaseStubClass';
import {stubMethod} from '../../stubDecorator';
import {IBlocksModuleUtils} from "../../../../src/ioc/interfaces/modules";
import {SignedAndChainedBlockType} from "../../../../src/logic";
import {RawFullBlockListType} from "../../../../src/types/rawDBTypes";
import {BlockProgressLogger} from "../../../../src/helpers";
import {publicKey} from "../../../../src/types/sanityTypes";

@injectable()
export default class BlocksModuleUtilsStub extends BaseStubClass implements IBlocksModuleUtils {

    @stubMethod()
    readDbRows(rows: RawFullBlockListType[]): SignedAndChainedBlockType[] {
        return undefined;
    }

    @stubMethod()
    loadBlocksPart(filter: { limit?: number; id?: string; lastId?: string }): Promise<SignedAndChainedBlockType[]> {
        return undefined;
    }

    @stubMethod()
    loadLastBlock(): Promise<SignedAndChainedBlockType> {
        return undefined;
    }

    @stubMethod()
    getIdSequence(height: number): Promise<{ firstHeight: number; ids: string[] }> {
        return undefined;
    }

    @stubMethod()
    loadBlocksData(filter: { limit?: number; id?: string; lastId?: string }): Promise<RawFullBlockListType[]> {
        return undefined;
    }

    @stubMethod()
    getBlockProgressLogger(txCount: number, logsFrequency: number, msg: string): BlockProgressLogger {
        return undefined;
    }

    @stubMethod()
    aggregateBlockReward(filter: { generatorPublicKey: publicKey; start?: number; end?: number }): Promise<{ fees: number; rewards: number; count: number }> {
        return undefined;
    }

    // TODO Add more methods when needed
}
