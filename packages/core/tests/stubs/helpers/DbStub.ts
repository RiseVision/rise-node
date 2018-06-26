import { injectable } from 'inversify';
import * as sequelize from 'sequelize';
import { BaseStubClass } from '../BaseStubClass';
import { DBOp } from '../../../src/types/genericTypes';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class DbStub extends BaseStubClass {

  @stubMethod()
  public async performOps(what: Array<DBOp<any>>, transaction?: sequelize.Transaction) {
    return null;
  }
}
