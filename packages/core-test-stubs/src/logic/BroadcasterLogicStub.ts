import { IBroadcasterLogic } from '@risevision/core-interfaces';
import { BroadcastTaskOptions, PeerType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

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
