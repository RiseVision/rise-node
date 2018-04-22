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
import { publicKey } from '../types/sanityTypes';
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


  // Unconfirmed stuff

  @Column
  public u_isDelegate: boolean;
  @Column
  public u_secondSignature: boolean;
  @Column
  public u_username: boolean;
  @Column
  public u_balance: boolean;


  public isMultisignature(): boolean {
    return this.multilifetime > 0;
  }

  private _hexPublicKey: publicKey;
  public get hexPublicKey(): publicKey {
    if (typeof(this._hexPublicKey) === 'undefined') {
      if (this.publicKey === null) {
        this._hexPublicKey = null;
      } else {
        this._hexPublicKey = this.publicKey.toString('hex');
      }
    }
    return this._hexPublicKey;

  }

}
