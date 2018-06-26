import { Column, PrimaryKey, Table } from 'sequelize-typescript';
import { IBaseModel } from './BaseModel';

@Table({ tableName: 'info' })
export class InfoModel extends IBaseModel<InfoModel> {
  @PrimaryKey
  @Column
  public key: string;
  @Column
  public value: string;

}
