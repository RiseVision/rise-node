import { PeerState } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export class IPeersModel extends IBaseModel<IPeersModel> {
  public ip: string;

  public port: number;

  public state: PeerState;

  public os: string;

  public version: string;

  public clock: number;

  public broadhash: Buffer;

  public height: number;
}
