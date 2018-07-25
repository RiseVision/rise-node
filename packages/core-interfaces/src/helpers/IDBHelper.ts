import { DBOp } from '@risevision/core-types';
import * as sequelize from 'sequelize';

export interface IDBHelper {
  performOps(what: Array<DBOp<any>>, transaction?: sequelize.Transaction): Promise<void>
}
