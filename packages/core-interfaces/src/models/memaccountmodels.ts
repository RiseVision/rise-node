import { IBaseModel } from './IBaseModel';

export interface IAccounts2DelegatesModel extends IBaseModel<IAccounts2DelegatesModel> {
  dependentId: string;
  accountId: string;
}

export interface IAccounts2U_DelegatesModel extends IBaseModel<IAccounts2U_DelegatesModel> {
  dependentId: string;
  accountId: string;
}

export interface IAccounts2MultisignaturesModel extends IBaseModel<IAccounts2MultisignaturesModel> {
  dependentId: string;
  accountId: string;
}

export interface IAccounts2U_MultisignaturesModel extends IBaseModel<IAccounts2U_MultisignaturesModel> {
  dependentId: string;
  accountId: string;
}