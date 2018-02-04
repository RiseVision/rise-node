import { injectable } from 'inversify';
import { BlockProgressLogger } from '../../../../src/helpers';
import { IBlocksModuleUtils } from '../../../../src/ioc/interfaces/modules';
import { SignedAndChainedBlockType } from '../../../../src/logic';
import { RawFullBlockListType } from '../../../../src/types/rawDBTypes';
import { publicKey } from '../../../../src/types/sanityTypes';
import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';

@injectable()
export class BlocksSubmoduleUtilsStub extends BaseStubClass implements IBlocksModuleUtils {
  @stubMethod()
  public readDbRows(rows: RawFullBlockListType[]): SignedAndChainedBlockType[] {
    return undefined;
  }

  @stubMethod()
  public loadBlocksPart(filter: { limit?: number; id?: string; lastId?: string }): Promise<SignedAndChainedBlockType[]> {
    return undefined;
  }

  @stubMethod()
  public loadLastBlock(): Promise<SignedAndChainedBlockType> {
    return undefined;
  }

  @stubMethod()
  public getIdSequence(height: number): Promise<{ firstHeight: number; ids: string[] }> {
    return undefined;
  }

  @stubMethod()
  public loadBlocksData(filter: { limit?: number; id?: string; lastId?: string }): Promise<RawFullBlockListType[]> {
    return undefined;
  }

  @stubMethod()
  public getBlockProgressLogger(txCount: number, logsFrequency: number, msg: string): BlockProgressLogger {
    return undefined;
  }

  @stubMethod()
  public aggregateBlockReward(filter: { generatorPublicKey: publicKey; start?: number; end?: number }): Promise<{ fees: number; rewards: number; count: number }> {
    return undefined;
  }

}