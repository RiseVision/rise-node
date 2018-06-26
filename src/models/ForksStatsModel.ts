import { Column, DataType, PrimaryKey, Table } from 'sequelize-typescript';
import { ForkType } from '../helpers';
import { BaseModel } from './BaseModel';

@Table({ tableName: 'forks_stat' })
export class ForksStatsModel extends BaseModel<ForksStatsModel> {
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
  public cause: ForkType

}
