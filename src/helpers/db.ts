import * as sequelize from 'sequelize';
import { DBCreateOp, DBCustomOp, DBOp, DBRemoveOp, DBUpdateOp, DBUpsertOp } from '../types/genericTypes';

export class DBHelper {
  /**
   * Batches operations together and performs them parallelly (eventually in a transaction)
   * @param {Array<IDBOp<any>>} what
   * @param {sequelize.Transaction} transaction
   * @returns {Promise<[Model<string>[] , any]>}
   */
  public async performOps(what: Array<DBOp<any>>, transaction?: sequelize.Transaction) {
    const baseOptions: any = {};
    if (transaction) {
      baseOptions.transaction = transaction;
    }
    for (const op of what) {
      switch (op.type) {
        case 'create':
          await op.model.create(op.values, baseOptions);
          break;
        case 'update':
          await op.model.update(op.values, {... baseOptions, ... op.options});
          break;
        case 'upsert':
          await op.model.upsert(op.values, {... baseOptions, ... op.options});
          break;
        case 'remove':
          await op.model.destroy({... baseOptions, ... op.options});
          break;
        case 'custom':
          await op.model.sequelize.query(op.query, baseOptions);
          break;
      }
    }

  }

}
