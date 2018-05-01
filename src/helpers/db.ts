import * as sequelize from 'sequelize';
import { DBOp, DBUpdateOp } from '../types/genericTypes';

export class DBHelper {
  /**
   * Batches operations together and performs them parallelly (eventually in a transaction)
   * @param {Array<IDBOp<any>>} what
   * @param {sequelize.Transaction} transaction
   * @returns {Promise<[Model<string>[] , any]>}
   */
  public async performOps(what: Array<DBOp<any>>, transaction?: sequelize.Transaction) {
    const modelClusters: { [models: string]: Array<DBOp<any>> } = {};
    for (const element of what) {
      const name          = element.model.prototype.constructor.name;
      modelClusters[name] = modelClusters[name] || [];
      modelClusters[name].push(element);
    }
    return Promise.all(
      Object.keys(modelClusters)
        .map((k) => {
          const model = modelClusters[k][0].model;

          const creations = modelClusters[k]
            .filter((item: DBOp<any>) => item.type === 'create')
            .map((item) => item.values);

          const updates: Array<DBUpdateOp<any>> = modelClusters[k]
            .filter((item) => item.type === 'update') as any;

          return model.bulkCreate(creations, {transaction})
            .then(() => Promise
              .all(updates
                .map(({values, options}) => {
                  return model.update(values, {...{transaction}, ...options});
                })
              )
            );
        })
    );

  }

}
