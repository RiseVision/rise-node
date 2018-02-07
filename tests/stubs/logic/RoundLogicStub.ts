import { injectable } from 'inversify';
import { IRoundLogic } from '../../../src/ioc/interfaces/logic';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class RoundLogicStub extends BaseStubClass implements IRoundLogic {

    @stubMethod()
    public mergeBlockGenerator(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public updateMissedBlocks(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public getVotes(): Promise<Array<{ delegate: string; amount: number }>> {
        return undefined;
    }

    @stubMethod()
    public updateVotes(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public markBlockId(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public flushRound(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public truncateBlocks(): Promise<null> {
        return undefined;
    }

    @stubMethod()
    public restoreRoundSnapshot(): Promise<null> {
        return undefined;
    }

    @stubMethod()
    public restoreVotesSnapshot(): Promise<null> {
        return undefined;
    }

    @stubMethod()
    public applyRound(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public land(): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public backwardLand(): Promise<void> {
        return undefined;
    }

}