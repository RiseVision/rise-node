import { PeerType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseRequest } from './BaseRequest';
import { MyConvOptions } from '../helpers';

// tslint:disable-next-line
export type PeersListRequestDataType = {peers: PeerType[]};

@injectable()
export class PeersListRequest extends BaseRequest<{peers: PeerType[]}, PeersListRequestDataType> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res) {
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
