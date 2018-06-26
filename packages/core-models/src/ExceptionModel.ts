import { Column, PrimaryKey, Table } from 'sequelize-typescript';
import { IBaseModel } from './BaseModel';

@Table({ tableName: 'exceptions' })
export class ExceptionModel extends IBaseModel<ExceptionModel> {
  @PrimaryKey
  @Column
  public key: string;
  @PrimaryKey
  @Column
  public type: string;
  @PrimaryKey
  @Column
  public remainingCount: number;
}
