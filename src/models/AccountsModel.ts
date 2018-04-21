// tslint:disable
import {
  Table,
  Column,
  Model,
  HasMany,
  DataType,
  PrimaryKey,
  AfterCreate,
  AfterUpdate,
  IBuildOptions, BeforeCreate, BeforeUpdate, AfterFind, BeforeFind
} from 'sequelize-typescript';
import 'reflect-metadata';
import {Sequelize} from 'sequelize-typescript';
import { AfterInit } from 'sequelize-typescript/lib/annotations/hooks/AfterInit';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
var pg = require('pg')

pg.types.setTypeParser(20, 'text', parseInt)

@Table({tableName: 'mem_accounts'})
export class AccountsModel extends Model<AccountsModel> {
  @Column
  public username: string;
  @Column
  public isDelegate: boolean;

  @Column
  public secondSignature: boolean;

  @PrimaryKey
  @Column
  public address: string;

  @Column(DataType.BLOB)
  public publicKey: Buffer;

  @Column(DataType.BLOB)
  public secondPublicKey: Buffer;

  @Column
  public balance: number;

  @Column
  public vote: string;

  @Column
  public rate: string;

  @Column
  public multimin: number;

  @Column
  public multilifetime: number;

  @Column
  public blockId: string;

  @Column
  public producedblocks: number;

  @Column
  public missedblocks: number;

  @Column
  public fees: string;
  @Column
  public rewards: string;
  @Column
  public virgin: boolean;


}
