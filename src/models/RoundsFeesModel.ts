import {
  Column,
  DataType,
  Model,
  Table
} from 'sequelize-typescript';

@Table({tableName: 'rounds_fees'})
export class RoundsFeesModel extends Model<RoundsFeesModel> {
  @Column
  public height: number;

  @Column
  public fees: number;

  @Column
  public timestamp: number;

  @Column(DataType.BLOB)
  public publicKey: Buffer;

}
