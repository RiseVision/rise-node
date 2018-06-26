import {
  Column,
  DataType,
  Table
} from 'sequelize-typescript';
import { IBaseModel } from './BaseModel';

@Table({tableName: 'rounds_fees'})
export class RoundsFeesModel extends IBaseModel<RoundsFeesModel> {
  @Column
  public height: number;

  @Column
  public fees: number;

  @Column
  public timestamp: number;

  @Column(DataType.BLOB)
  public publicKey: Buffer;

}
