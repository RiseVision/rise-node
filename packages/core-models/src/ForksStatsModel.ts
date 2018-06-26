import { ForkType } from '@risevision/core-types';
import { IForkStatsModel } from '@risevision/core-interfaces';
import { Column, DataType, PrimaryKey, Table } from 'sequelize-typescript';
import { BaseModel } from './BaseModel';

@Table({ tableName: 'forks_stat' })
export class ForksStatsModel extends BaseModel<ForksStatsModel> implements IForkStatsModel {
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
