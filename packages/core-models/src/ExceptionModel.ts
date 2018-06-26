import { Column, PrimaryKey, Table } from 'sequelize-typescript';
import { BaseModel } from './BaseModel';

@Table({ tableName: 'exceptions' })
export class ExceptionModel extends BaseModel<ExceptionModel> {
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
