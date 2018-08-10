// tslint:disable object-literal-sort-keys
import { Symbols } from '../../../core-interfaces/dist';

export const ModelSymbols = {
  model             : Symbol.for('models.model'),
  sequelize         : Symbol.for('models.sequelize'),
  sequelizeNamespace: Symbol.for('models.sequelizeNamespace'),
  helpers           : {
    db: Symbols.helpers.db,
  },
  names             : {
    accounts    : Symbol.for('models.accountsModel'),
    blocks      : Symbols.models.blocks,
    exceptions  : Symbol.for('models.exceptionsModel'),
    forkStats   : Symbol.for('models.forkStatsModel'),
    info        : Symbol.for('models.infoModel'),
    migrations  : Symbol.for('models.migrationsModel'),
    transactions: Symbols.models.transactions,
  },
};
