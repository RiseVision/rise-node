import { injectable } from 'inversify';
import { IPeerLogic, IPeersLogic } from '../../../src/ioc/interfaces/logic';
import { BasePeerType, PeerType } from '../../../src/logic';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class PeersLogicStub extends BaseStubClass implements IPeersLogic {
  @stubMethod()
  public create(peer: BasePeerType): IPeerLogic {
    return undefined;
  }

  @stubMethod()
  public exists(peer: BasePeerType): boolean {
    return undefined;
  }

  @stubMethod()
  public get(peer: PeerType | string) {
    return undefined;
  }

  @stubMethod()
  public upsert(peer: PeerType, insertOnly: boolean): boolean {
    return undefined;
  }

  @stubMethod()
  public remove(peer: BasePeerType): boolean {
    return undefined;
  }

  @stubMethod()
  public list(normalize): any {
    return undefined;
  }

  public acceptable(peers: IPeerLogic[]): IPeerLogic[];
  @stubMethod()
  public acceptable(peers: PeerType[]): PeerType[] {
    return undefined;
  }

}
