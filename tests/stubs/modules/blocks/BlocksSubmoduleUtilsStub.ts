import { injectable, inject } from 'inversify';
import { BlockProgressLogger, ILogger } from '../../../../src/helpers';
import { IBlocksModuleUtils } from '../../../../src/ioc/interfaces/modules';
import { SignedAndChainedBlockType } from '../../../../src/logic';
import { RawFullBlockListType } from '../../../../src/types/rawDBTypes';
import { publicKey } from '../../../../src/types/sanityTypes';
import { BaseStubClass } from '../../BaseStubClass';
import { spyMethod, stubMethod } from '../../stubDecorator';
import { Symbols } from '../../../../src/ioc/symbols';
import { BlocksModel } from '../../../../src/models';

@injectable()
export class BlocksSubmoduleUtilsStub extends BaseStubClass implements IBlocksModuleUtils {

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @spyMethod
  public getBlockProgressLogger(txCount: number, logsFrequency: number, msg: string): BlockProgressLogger {
    return new BlockProgressLogger(txCount, logsFrequency, msg, this.logger);
  }

  @stubMethod()
  public readDbRows(rows: RawFullBlockListType[]): SignedAndChainedBlockType[] {
    return null;
  }

  @stubMethod()
  public loadBlocksPart(filter: { limit?: number, id?: string, lastId?: string }): Promise<BlocksModel[]> {
    return null;
  }

  @stubMethod()
  public loadLastBlock(): Promise<BlocksModel> {
    return null;
  }

  @stubMethod()
  public getIdSequence(height: number): Promise<{ firstHeight: number, ids: string[] }> {
    return null;
  }

  @stubMethod()
  public loadBlocksData(filter: { limit?: number, id?: string, lastId?: string }): Promise<BlocksModel[]> {
    return null;
  }

  @stubMethod()
  public aggregateBlockReward(filter: { generatorPublicKey: publicKey, start?: number, end?: number }): Promise<{ fees: number, rewards: number, count: number }> {
    return null;
  }

}