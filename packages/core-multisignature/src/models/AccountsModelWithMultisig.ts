import 'reflect-metadata';
// import { IAccountsModel } from '@risevision/core-interfaces';
import { AccountsModel } from '@risevision/core-models';
import { Column, Model, Sequelize, Table } from 'sequelize-typescript';
// import * as extend from 'extend';

// tslint:disable-next-line
@Table({tableName: 'mem_accounts'})
export class AccountsModelWithMultisig extends Model<AccountsModel> {
  // public multimin: number;
  @Column
  public u_multimin: number;
  // public multilifetime: number;
  // public u_multilifetime: number;
  // public u_multisignatures: string[];
  // public multisignatures: string[];

  public isMultisignature(): boolean {
    throw new Error('erorr');
  };
}
//
// // tslint:disable
// function mergeModels(what: typeof Model, into: typeof Model) {
//   const fakeSequelize = new Sequelize({
//     database: 'test',
//     //dialect: 'sqlite',
//     dialect : 'postgres',
//     username: 'root',
//     password: 'test',
//     //storage: ':memory',
//     logging : !('SEQ_SILENT' in process.env),
//   });
//
//   fakeSequelize.addModels([what]);
//
//
// }
// console.log(AccountsModel.options);
// const s2 = new Sequelize({
//   database: 'test',
//   //dialect: 'sqlite',
//   dialect : 'postgres',
//   username: 'root',
//   password: 'test',
//   //storage: ':memory',
//   logging : !('SEQ_SILENT' in process.env),
// })
//
// s2.addModels([AccountsModelWithMultisig]);
// console.log(AccountsModel);

