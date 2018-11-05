import { IPeersModel } from '@risevision/core-interfaces';
import { PeerState } from '@risevision/core-types';
import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'peers' })
export class PeersModel extends Model<PeersModel> implements IPeersModel {
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
