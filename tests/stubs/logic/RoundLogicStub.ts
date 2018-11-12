import { injectable } from 'inversify';
import { IRoundLogic } from '../../../src/ioc/interfaces/logic';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { DBCustomOp, DBOp } from '../../../src/types/genericTypes';

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
  public apply(): Array<DBOp<any>> {
    return null;
  }

  @stubMethod()
  public undo(): Array<DBOp<any>> {
    return null;
  }
}
