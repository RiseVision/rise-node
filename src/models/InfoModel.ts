import { Column, PrimaryKey, Table } from 'sequelize-typescript';
import { BaseModel } from './BaseModel';

@Table({ tableName: 'info' })
export class InfoModel extends BaseModel<InfoModel> {
  @PrimaryKey
  @Column
  public key: string;
  @Column
  public value: string;

}
