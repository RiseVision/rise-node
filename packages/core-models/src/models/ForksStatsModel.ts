import { IForkStatsModel } from '@risevision/core-interfaces';
import { ForkType } from '@risevision/core-types';
import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

@Table({ tableName: 'forks_stat' })
export class ForksStatsModel extends Model<ForksStatsModel>
  implements IForkStatsModel {
  @PrimaryKey
  @Column(DataType.BLOB)
  public generatorPublicKey: Buffer;

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
