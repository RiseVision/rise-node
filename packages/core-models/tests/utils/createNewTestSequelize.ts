import { Sequelize } from 'sequelize-typescript';
// tslint:disable object-literal-sort-keys no-hardcoded-credentials
export function createNewTestSequelize(): Sequelize {
  return new Sequelize({
    database: 'test',
    dialect: 'postgres',
    username: 'root',
    password: 'test',
    logging: !('SEQ_SILENT' in process.env),
  });
}
