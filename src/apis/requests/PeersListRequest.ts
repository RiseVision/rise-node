import { BaseRequest } from './BaseRequest';
import { PeerType } from '../../logic';
import { injectable } from 'inversify';
import { IPeerLogic } from '../../ioc/interfaces/logic';

export type PeersListRequestDataType = {peers: PeerType[]};

@injectable()
export class PeersListRequest extends BaseRequest<any, PeersListRequestDataType> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res): {peers: PeerType[]} {
    return this.isProtoBuf() ? this.decodeProtoBufResponse(res, 'transportPeers') : res.body;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/list' : '/peer/list';
  }

  protected decodeProtoBufResponse(res: {body: Buffer, peer: IPeerLogic}, pbNamespace: string, pbMessageType?: string) {
    const result = super.decodeProtoBufResponse(res, pbNamespace, pbMessageType)
    result.peers = result.peers.map((p) => {
      return {...p, updated: p.updated.toNumber()};
    });
    return result;
  }
}
