import { IInfoModel } from '@risevision/core-interfaces';
import { Column, PrimaryKey, Table } from 'sequelize-typescript';
import { BaseModel } from './BaseModel';

@Table({ tableName: 'info' })
export class InfoModel extends BaseModel<InfoModel> implements IInfoModel {
  @PrimaryKey
  @Column
  public key: string;
  @Column
  public value: string;

}
