// tslint:disable
import { Column, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import 'reflect-metadata';
import { publicKey } from '../types/sanityTypes';
import { BlocksModel } from './BlocksModel';
import { AccountsModel } from './AccountsModel';


@Table({ tableName: 'mem_rounds' })
export class MemRoundsModel extends Model<MemRoundsModel> {
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public address: string;

  @PrimaryKey
  @Column
  public amount: number;

  @PrimaryKey
  @Column
  public delegate: publicKey;

  @PrimaryKey
  @ForeignKey(() => BlocksModel)
  @Column
  public blockId: string;

  @PrimaryKey
  @Column
  public round: number;


}
