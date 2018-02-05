import {injectable} from 'inversify';

import {BaseStubClass} from '../BaseStubClass';
import {stubMethod} from '../stubDecorator';
import * as sinon from "sinon";

// tslint:disable no-empty

@injectable()
export default class SocketIOStub /*implements IDatabase<any>*/ {


    public sockets;

    constructor() {
        this.stubReset();
    }

    public stubReset() {
        this.sockets = {
            emit: sinon.stub()
        };
    }

    // TODO Add more methods when needed
}
