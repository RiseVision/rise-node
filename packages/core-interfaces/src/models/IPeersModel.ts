import { PeerState } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export interface IPeersModel extends IBaseModel<IPeersModel> {
  ip: string;

  port: number;

  state: PeerState;

  os: string;

  version: string;

  clock: number;

  broadhash: Buffer;

  height: number;
}
