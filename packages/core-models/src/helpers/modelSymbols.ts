// tslint:disable object-literal-sort-keys
import { Symbols } from '@risevision/core-interfaces';

export const ModelSymbols = {
  model: Symbol.for('models.model'),
  sequelize: Symbol.for('models.sequelize'),
  sequelizeNamespace: Symbol.for('models.sequelizeNamespace'),
  helpers: {
    db: Symbols.helpers.db,
  },
  names: {
    accounts: Symbols.models.accounts,
    blocks: Symbols.models.blocks,
    exceptions: Symbol.for('models.exceptionsModel'),
    forkStats: Symbols.models.forkStats,
    info: Symbol.for('models.infoModel'),
    migrations: Symbol.for('models.migrationsModel'),
    transactions: Symbols.models.transactions,
  },
};
