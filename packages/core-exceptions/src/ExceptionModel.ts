import { Column, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'exceptions', timestamps: false })
export class ExceptionModel extends Model<ExceptionModel> {
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
