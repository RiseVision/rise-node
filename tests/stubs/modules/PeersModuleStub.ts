import { injectable } from 'inversify';
import { IPeerLogic } from '../../../src/ioc/interfaces/logic';
import { IPeersModule } from '../../../src/ioc/interfaces/modules';
import { PeerState, PeerType } from '../../../src/logic';
import { PeerFilter } from '../../../src/modules';
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
  public getByFilter(filter: PeerFilter): Promise<IPeerLogic[]> {
    return undefined;
  }

  @stubMethod()
  // tslint:disable-next-line max-line-length
  public list(options: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }): Promise<{ consensus: number, peers: IPeerLogic[] }> {
    return undefined;
  }

  @stubMethod()
  public cleanup() {
    return undefined;
  }
}
