import { Sequelize } from 'sequelize-typescript';

export function createNewTestSequelize(): Sequelize {
  return new Sequelize({
    database: 'test',
    dialect: 'postgres',
    username: 'root',
    password: 'test',
    logging: !('SEQ_SILENT' in process.env),
  });
}
