import { IRoundLogic } from '@risevision/core-interfaces';
import { DBCustomOp, DBOp } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class RoundLogicStub extends BaseStubClass implements IRoundLogic {

  @stubMethod()
  public mergeBlockGenerator(): Array<DBOp<any>> {
    return null;
  }

  @stubMethod()
  public updateMissedBlocks(): DBOp<any> {
    return null;
  }

  @stubMethod()
  public updateVotes(): DBCustomOp<any> {
    return null;
  }

  @stubMethod()
  public markBlockId(): DBOp<any> {
    return null;
  }

  @stubMethod()
  public flushRound(): DBOp<any> {
    return null;
  }

  @stubMethod()
  public truncateBlocks(): DBOp<any> {
    return null;
  }

  @stubMethod()
  public restoreRoundSnapshot(): DBOp<any> {
    return null;
  }

  @stubMethod()
  public restoreVotesSnapshot(): DBOp<any> {
    return null;
  }

  @stubMethod()
  public applyRound(): Array<DBOp<any>> {
    return null;
  }

  @stubMethod()
  public land(): Array<DBOp<any>> {
    return null;
  }

  @stubMethod()
  public backwardLand(): Array<DBOp<any>> {
    return null;
  }
}
