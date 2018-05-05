import { BigNumber } from 'bignumber.js';
import * as fs from 'fs';
import * as path from 'path';
import * as sequelize from 'sequelize';
import { MigrationsModel } from '../models';
import MyBigNumb from './bignum';

export class Migrator {
  constructor(private m: typeof MigrationsModel) {

  }

  public async checkMigrations(): Promise<boolean> {
    const row = await this.m.sequelize
      .query('SELECT to_regclass(\'migrations\')', { raw: true, type: sequelize.QueryTypes.SELECT });
    return row.to_regclass;
  }

  /**
   * Gets last migration record from db table
   */
  public async getLastMigration(hasMigration: boolean): Promise<BigNumber> {
    if (!hasMigration) {
      return;
    }

    const row = await this.m.findOne({
      limit: 1,
      order: [['id', 'DESC']],
    });
    if (row) {
      return new MyBigNumb(row.id);
    }
    return new MyBigNumb(0);
  }

  /**
   * Reads sql migration folder and returns only pending migrations sqls.
   */
  // tslint:disable-next-line max-line-length
  public async readPendingMigrations(lastMigration: BigNumber): Promise<Array<{ id: BigNumber, name: string, path: string }>> {
    const migrationsPath = path.join(process.cwd(), 'sql', 'migrations');

    function matchMigrationName(file) {
      const name = file.match(/_.+\.sql$/);

      return Array.isArray(name) ? name[0].replace(/_/, '').replace(/\.sql$/, '') : null;
    }

    function matchMigrationId(file) {
      const id = file.match(/^[0-9]+/);

      return Array.isArray(id) ? new MyBigNumb(id[0]) : null;
    }

    return fs.readdirSync(migrationsPath)
      .map((file) => ({
        id  : matchMigrationId(file),
        name: matchMigrationName(file),
        path: path.join(migrationsPath, file),
      }))
      // only non null and existing file ending with .sql
      .filter((d) => (d.id && d.name))
      .filter((d) => fs.statSync(d.path).isFile())
      .filter((d) => /\.sql$/.test(d.path))
      // Filter only pending migrations
      .filter((d) => !lastMigration || d.id.isGreaterThan(lastMigration));
  }

  public async applyPendingMigrations(pendingMigrations: Array<{ id: BigNumber, name: string, path: string }>) {
    for (const m of pendingMigrations) {
      await this.m.sequelize.query(fs.readFileSync(m.path, {encoding: 'utf8'}));
    }
    return pendingMigrations;
  }

  /**
   * Inserts into `migrations` table the previous applied migrations.
   */
  public async insertAppliedMigrations(appMigrs: Array<{ id: BigNumber, name: string, path: string }>) {
    for (const m of appMigrs) {
      await this.m.create({id: m.id.toString(), name: m.name});
    }
  }

  /**
   * Executes 'runtime.sql' file, that set peers clock to null and state to 1.
   * @method
   * @return {function} waterCb with error
   */
  public applyRuntimeQueryFile() {
    return Promise.resolve(
      this.m.sequelize.query(fs.readFileSync(path.join(process.cwd(), 'sql', 'runtime.sql'), {encoding:'utf8'}));
    );
  }
}
