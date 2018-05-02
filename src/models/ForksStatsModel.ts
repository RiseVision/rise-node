// tslint:disable
import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';
import 'reflect-metadata';
import { ForkType } from '../helpers';


@Table({ tableName: 'forks_stat' })
export class ForksStatsModel extends Model<ForksStatsModel> {
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
