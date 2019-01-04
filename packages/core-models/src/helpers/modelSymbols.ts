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
    transactions: Symbols.models.transactions,
  },
};
