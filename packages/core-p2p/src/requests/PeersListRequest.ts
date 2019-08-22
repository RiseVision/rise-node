import { PeerState, PeerType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { P2PConstantsType, p2pSymbols } from '../helpers';
import { PeersModule } from '../peersModule';
import {
  BaseProtobufTransportMethod,
  ProtoIdentifier,
} from './BaseProtobufTransportMethod';

// tslint:disable-next-line
export type PeersListResponse = { peers: PeerType[] };

@injectable()
export class PeersListRequest extends BaseProtobufTransportMethod<
  null,
  null,
  PeersListResponse
> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl = '/v2/peer/list';

  protected readonly protoResponse: ProtoIdentifier<PeersListResponse> = {
    convOptions: { longs: Number },
    messageType: 'transportPeers',
    namespace: 'p2p.peers',
  };

  @inject(p2pSymbols.modules.peers)
  private peersModule: PeersModule;
  @inject(p2pSymbols.constants)
  private p2pConstants: P2PConstantsType;

  protected async produceResponse(payload: any): Promise<PeersListResponse> {
    const peers = this.peersModule.getPeers({
      allowedStates: [PeerState.CONNECTED],
      limit: this.p2pConstants.maxPeers,
    });
    return { peers };
  }
}
