import { ForkType } from '@risevision/core-types';
import { Column, DataType, PrimaryKey, Table } from 'sequelize-typescript';
import { IBaseModel } from './BaseModel';

@Table({ tableName: 'forks_stat' })
export class ForksStatsModel extends IBaseModel<ForksStatsModel> {
  @PrimaryKey
  @Column(DataType.BLOB)
  public delegatePublicKey: Buffer;

  @PrimaryKey
  @Column
  public blockTimestamp: number;

  @PrimaryKey
  @Column
  public blockId: string;

  @PrimaryKey
  @Column
  public blockHeight: number;

  @PrimaryKey
  @Column
  public previousBlock: string;

  @PrimaryKey
  @Column(DataType.INTEGER)
  public cause: ForkType;

}
