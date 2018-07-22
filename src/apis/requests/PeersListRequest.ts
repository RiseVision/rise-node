import { injectable } from 'inversify';
import { MyConvOptions } from '../../helpers';
import { PeerType } from '../../logic';
import { BaseRequest } from './BaseRequest';

// tslint:disable-next-line
export type PeersListRequestDataType = {peers: PeerType[]};

@injectable()
export class PeersListRequest extends BaseRequest<any, PeersListRequestDataType> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res): {peers: PeerType[]} {
    return this.peerSupportsProtoBuf(res.peer) ?
      this.decodeProtoBufResponse(res, 'transportPeers') :
      res.body;
  }

  protected getBaseUrl(isProtoBuf: boolean) {
    return isProtoBuf ? '/v2/peer/list' : '/peer/list';
  }

  protected getConversionOptions(): MyConvOptions<PeersListRequestDataType> {
    return {
      ...super.getConversionOptions(),
      longs: Number,
    };
  }
}
