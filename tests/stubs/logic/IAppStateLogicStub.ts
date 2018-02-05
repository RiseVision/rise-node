import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import {IAppState} from "../../../src/ioc/interfaces/logic";

@injectable()
export default class IAppStateStub extends BaseStubClass implements IAppState {
    @stubMethod()
    public set(): string {
        return undefined;
    }

    @stubMethod()
    public setComputed(): string {
        return undefined;
    }

    @stubMethod()
    public get(): any {
        return undefined;
    }

    @stubMethod()
    public getComputed(): any {
        return undefined;
    }
}
