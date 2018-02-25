import {injectable} from 'inversify';
import * as sinon from 'sinon';

// tslint:disable no-empty
@injectable()
export default class SocketIOStub {
    public sockets;

    constructor() {
        this.stubReset();
    }

    public stubReset() {
        this.sockets = {
            emit: sinon.stub(),
        };
    }
    // TODO Add more methods when needed
}
