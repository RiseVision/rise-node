import {
  BasePeerType,
  ITransportTransaction,
  PeerState,
  PeerRequestOptions
} from '@risevision/core-types';
import { IPeerLogic, IAPIRequest } from '../logic';
import { IModule } from './IModule';

export interface ITransportModule extends IModule {

  getFromPeer<T>(peer: BasePeerType, options: PeerRequestOptions): Promise<{ body: T, peer: IPeerLogic }>;

  getFromRandomPeer<T>(config: { limit?: number, broadhash?: string, allowedStates?: PeerState[] },
                       requestHandler: IAPIRequest<any, any>): Promise<{ body: any; peer: IPeerLogic }>;

}
