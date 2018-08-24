import { PeerRequestOptions } from '@risevision/core-types';
import { IPeerLogic } from './IPeerLogic';

export interface IAPIRequest<Out, In> {
  getRequestOptions(peerSupportsProto: boolean): PeerRequestOptions;
  getResponseData(res: {body: Buffer | Out, peer: IPeerLogic}): Out;
  getOrigOptions(): { data: In, query?: any};
  mergeIntoThis(...objs: this[]): void;
  makeRequest(peer: IPeerLogic): Promise<Out>;
  isRequestExpired(): Promise<boolean>;
}
