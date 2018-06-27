import { IAppState } from '@risevision/core-interfaces';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

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
