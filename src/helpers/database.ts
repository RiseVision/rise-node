import { BigNumber } from 'bignumber.js';
import * as fs from 'fs';
import * as path from 'path';
import * as monitor from 'pg-monitor';
import * as pgPromise from 'pg-promise';
import { IDatabase } from 'pg-promise';
import { AppConfigDatabase } from '../types/genericTypes';
import MyBigNumb from './bignum';
import { ILogger } from './logger';

export class Migrator {
  constructor(private pgp: pgPromise.IMain, private db: IDatabase<any>) {

  }

  public async checkMigrations(): Promise<boolean> {
    const row = await this.db.one('SELECT to_regclass(\'migrations\')');
    return row.to_regclass;
  }

  /**
   * Gets last migration record from db table
   */
  public async getLastMigration(hasMigration: boolean): Promise<BigNumber> {
    if (!hasMigration) {
      return;
    }

    const rows = await this.db.query('SELECT * FROM migrations ORDER BY "id" DESC LIMIT 1');
    if (rows[0]) {
      rows[0] = new MyBigNumb(rows[0].id);
    }
    return rows[0];
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
      .filter((d) => !lastMigration || d.id.greaterThan(lastMigration));
  }

  public async applyPendingMigrations(pendingMigrations: Array<{ id: BigNumber, name: string, path: string }>) {
    for (const m of pendingMigrations) {
      const sql = new (this.pgp.QueryFile)(m.path, { minify: true });
      await this.db.query(sql);
    }
    return pendingMigrations;
  }

  /**
   * Inserts into `migrations` table the previous applied migrations.
   */
  public async insertAppliedMigrations(appMigrs: Array<{ id: BigNumber, name: string, path: string }>) {
    for (const m of appMigrs) {
      await this.db.query(
        'INSERT INTO migrations(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING',
        [m.id.toString(), m.name]
      );
    }
  }

  /**
   * Executes 'runtime.sql' file, that set peers clock to null and state to 1.
   * @method
   * @param {function} waterCb - Callback function
   * @return {function} waterCb with error
   */
  public applyRuntimeQueryFile() {
    const dirname = path.basename(__dirname) === 'helpers' ? path.join(__dirname, '..') : __dirname;
    const sql     = new (this.pgp).QueryFile(path.join(process.cwd(), 'sql', 'runtime.sql'), { minify: true });
    return this.db.query(sql);
  }
}

export const connect = async (config: AppConfigDatabase, logger: ILogger): Promise<IDatabase<any>> => {
  const pgOptions = { pgNative: true };
  const pgp       = pgPromise(pgOptions);

  monitor.attach(pgOptions, config.logEvents);
  monitor.setTheme('matrix');

  (monitor as any).log = (msg, info) => {
    logger.log(info.event, info.text);
    info.display = false;
  };

  config.user = config.user || process.env.USER;

  const db       = pgp(config);
  const migrator = new Migrator(pgp, db);

  const hasMigrations   = await migrator.checkMigrations();
  const lastMigration   = await migrator.getLastMigration(hasMigrations);
  const pending         = await migrator.readPendingMigrations(lastMigration);
  const insertedPending = await migrator.applyPendingMigrations(pending);
  await migrator.insertAppliedMigrations(insertedPending);
  await migrator.applyRuntimeQueryFile();

  return db;
};
