import { IPeerLogic, IPeersModule } from '@risevision/core-interfaces';
import { PeerFilter, PeerState, PeerType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class PeersModuleStub extends BaseStubClass implements IPeersModule {

  @stubMethod()
  public update(peer: IPeerLogic): boolean {
    return undefined;
  }

  @stubMethod()
  public remove(peerIP: string, port: number): boolean {
    return undefined;
  }

  @stubMethod()
  public getByFilter(filter: PeerFilter): Promise<PeerType[]> {
    return undefined;
  }

  @stubMethod()
  // tslint:disable-next-line max-line-length
  public list(options: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }): Promise<{ consensus: number, peers: PeerType[] }> {
    return undefined;
  }

  @stubMethod()
  public cleanup() {
    return undefined;
  }
}
