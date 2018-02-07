import {BaseStubClass} from '../BaseStubClass';
import {stubMethod} from '../stubDecorator';

export class SequenceStub extends BaseStubClass {
    @stubMethod()
    public addAndPromise<T>(worker: () => Promise<T>): Promise<T> {
        return undefined;
    }

    // TODO Add more methods when needed
}
