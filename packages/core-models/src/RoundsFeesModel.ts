import { IRoundsFeesModel } from '@risevision/core-interfaces';
import { Column, DataType, Table } from 'sequelize-typescript';
import { BaseModel } from './BaseModel';

@Table({ tableName: 'rounds_fees' })
export class RoundsFeesModel extends BaseModel<RoundsFeesModel> implements IRoundsFeesModel {
  @Column
  public height: number;

  @Column
  public fees: number;

  @Column
  public timestamp: number;

  @Column(DataType.BLOB)
  public publicKey: Buffer;

}
