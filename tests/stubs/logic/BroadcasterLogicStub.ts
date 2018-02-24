import { injectable } from 'inversify';
import {BroadcastTaskOptions, PeerState, PeerType} from '../../../src/logic';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import {IBroadcasterLogic} from "../../../src/ioc/interfaces/logic";

@injectable()
export class BroadcasterLogicStub extends BaseStubClass implements IBroadcasterLogic {

    @stubMethod()
    public getPeers(params: { limit?: number; broadhash?: string }): Promise<PeerType[]> {
        return undefined;
    }

    @stubMethod()
    public enqueue(params: any, options: BroadcastTaskOptions): number {
        return undefined;
    }

    @stubMethod()
    public broadcast(params: { limit?: number; broadhash?: string; peers?: PeerType[] }, options: any): Promise<{ peer: PeerType[] }> {
        return undefined;
    }

    @stubMethod()
    public maxRelays(object: { relays?: number }): boolean {
        return undefined;
    }

    // TODO Add more methods when needed
}
