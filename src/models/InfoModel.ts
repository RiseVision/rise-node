import { Column, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'info' })
export class InfoModel extends Model<InfoModel> {
  @PrimaryKey
  @Column
  public key: string;
  @Column
  public value: string;

}
