import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class RoundsLogicStub extends BaseStubClass {

    @stubMethod()
    public calcRound() {}

    @stubMethod()
    public lastInRound() {}

    // TODO Add more methods when needed
}