import * as sequelize from 'sequelize';

import { DBOp } from '../../types';

export interface IDBHelper {
  performOps(
    what: Array<DBOp<any>>,
    transaction?: sequelize.Transaction
  ): Promise<void>;
}
