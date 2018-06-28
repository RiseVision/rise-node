import { IInfoModel } from '@risevision/core-interfaces';
import { Column, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'info' })
export class InfoModel extends Model<InfoModel> implements IInfoModel {
  @PrimaryKey
  @Column
  public key: string;
  @Column
  public value: string;

}
