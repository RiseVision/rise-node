import { ConstantsType, PeerType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { BaseProtobufTransportMethod, ProtoIdentifier } from './BaseProtobufTransportMethod';
import { Symbols } from '@risevision/core-interfaces';
import { p2pSymbols } from '../helpers';
import { PeersModule } from '../peersModule';

// tslint:disable-next-line
export type PeersListResponse = { peers: PeerType[] };

@injectable()
export class PeersListRequest extends BaseProtobufTransportMethod<null, null, PeersListResponse> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl = '/v2/peer/list';

  protected readonly protoResponse: ProtoIdentifier<PeersListResponse> = {
    convOptions: { longs: Number },
    messageType: 'transportPeers',
    namespace  : 'p2p.peers',
  };

  @inject(p2pSymbols.modules.peers)
  private peersModule: PeersModule;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  protected async produceResponse(payload: any): Promise<PeersListResponse> {
    return this.peersModule.list({ limit: this.constants.maxPeers });
  }
}
