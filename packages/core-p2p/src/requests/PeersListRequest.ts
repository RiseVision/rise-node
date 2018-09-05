import { PeerType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { MyConvOptions } from '../helpers';
import { BaseRequest } from './BaseRequest';

// tslint:disable-next-line
export type PeersListResponse = {peers: PeerType[]};

@injectable()
export class PeersListRequest extends BaseRequest<PeersListResponse, void> {
  protected readonly method: 'GET'   = 'GET';
  protected readonly supportsProtoBuf = true;

  protected getBaseUrl(isProtoBuf: boolean) {
    return isProtoBuf ? '/v2/peer/list' : '/peer/list';
  }

  protected getConversionOptions(): MyConvOptions<PeersListResponse> {
    return {
      ...super.getConversionOptions(),
      longs: Number,
    };
  }

  protected decodeProtoBufValidResponse(buf: Buffer) {
    return this.protoBufHelper.decode(buf, 'p2p.peers', 'transportPeers');
  }
}
