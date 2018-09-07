import { PeerType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseRequest } from './BaseRequest';

// tslint:disable-next-line
export type PeersListResponse = {peers: PeerType[]};

@injectable()
export class PeersListRequest extends BaseRequest<PeersListResponse, void> {
  protected readonly method: 'GET'   = 'GET';
  protected readonly baseUrl = '/v2/peer/list';

  protected decodeProtoBufValidResponse(buf: Buffer) {
    return this.protoBufHelper.decodeToObj(buf, 'p2p.peers', 'transportPeers', {
      longs: Number,
    });
  }

}
