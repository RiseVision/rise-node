// tslint:disable object-literal-sort-keys
export const ModelSymbols = {
  model             : Symbol('model'),
  sequelize         : Symbol('sequelize'),
  sequelizeNamespace: Symbol('sequelizeNamespace'),
  helpers           : {
    db: Symbol('dbHelper'),
  },
  names             : {
    accounts    : Symbol('accountsModel'),
    blocks      : Symbol('blocksModel'),
    exceptions  : Symbol('exceptionsModel'),
    forkStats   : Symbol('forkStatsModel'),
    info        : Symbol('infoModel'),
    migrations  : Symbol('migrationsModel'),
    transactions: Symbol('transactionsModel'),
  },
};
