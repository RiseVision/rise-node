import { IBlocksModel, IBlocksModuleUtils } from '@risevision/core-interfaces';
import { publicKey, RawFullBlockListType, SignedAndChainedBlockType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';

@injectable()
export class BlocksSubmoduleUtilsStub extends BaseStubClass implements IBlocksModuleUtils {

  @stubMethod()
  public getBlockProgressLogger(txCount: number, logsFrequency: number, msg: string): any {
    return null;
  }

  @stubMethod()
  public readDbRows(rows: RawFullBlockListType[]): SignedAndChainedBlockType[] {
    return null;
  }

  @stubMethod()
  public loadBlocksPart(filter: { limit?: number, id?: string, lastId?: string }): Promise<IBlocksModel[]> {
    return null;
  }

  @stubMethod()
  public loadLastBlock(): Promise<IBlocksModel> {
    return null;
  }

  @stubMethod()
  public getIdSequence(height: number): Promise<{ firstHeight: number, ids: string[] }> {
    return null;
  }

  @stubMethod()
  public loadBlocksData(filter: { limit?: number, id?: string, lastId?: string }): Promise<IBlocksModel[]> {
    return null;
  }

  @stubMethod()
  public aggregateBlockReward(filter: { generatorPublicKey: publicKey, start?: number, end?: number }): Promise<{ fees: number, rewards: number, count: number }> {
    return null;
  }

}