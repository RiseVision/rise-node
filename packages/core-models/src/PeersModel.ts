import { PeerState } from '@risevision/core-types';
import {
  Column,
  DataType,
  Table
} from 'sequelize-typescript';
import { IBaseModel } from './BaseModel';


@Table({tableName: 'peers'})
export class PeersModel extends IBaseModel<PeersModel> {
  @Column
  public ip: string;

  @Column
  public port: number;

  @Column(DataType.SMALLINT)
  public state: PeerState;

  @Column
  public os: string;

  @Column
  public version: string;

  @Column
  public clock: number;

  @Column(DataType.BLOB)
  public broadhash: Buffer;

  @Column
  public height: number;

}
