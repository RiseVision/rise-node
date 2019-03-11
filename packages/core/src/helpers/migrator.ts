import { LaunchpadSymbols } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import {
  ICoreModule,
  ILogger,
  IMigrationsModel,
  Symbols,
} from '@risevision/core-types';
import * as fs from 'fs';
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import * as sequelize from 'sequelize';
import { CoreSymbols } from '../symbols';
// tslint:disable-next-line interface-name
interface MigrationEntry {
  id: bigint;
  name: string;
  path: string;
  moduleName: string;
}
@injectable()
export class Migrator {
  @inject(ModelSymbols.model)
  @named(CoreSymbols.models.migrations)
  private MigrationsModel: typeof IMigrationsModel;

  @inject(LaunchpadSymbols.coremodules)
  private modules: Array<ICoreModule<any>>;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  public async init(): Promise<void> {
    const hasMigrations = await this.checkMigrations();
    const lastMigration = await this.getLastMigration(hasMigrations);
    const pending = await this.readPendingMigrations(lastMigration);
    const insertedPending = await this.applyPendingMigrations(pending);
    await this.insertAppliedMigrations(insertedPending);
  }

  private async checkMigrations(): Promise<boolean> {
    const [row] = await this.MigrationsModel.sequelize.query(
      "SELECT to_regclass('migrations')",
      { raw: true, type: sequelize.QueryTypes.SELECT }
    );
    return row.to_regclass !== null;
  }

  /**
   * Gets last migration record from db table
   */
  private async getLastMigration(hasMigration: boolean): Promise<bigint> {
    if (!hasMigration) {
      return;
    }

    const row = await this.MigrationsModel.findOne({
      limit: 1,
      order: [['id', 'DESC']],
    });
    if (row) {
      return BigInt(row.id);
    }
    return 0n;
  }

  /**
   * Reads sql migration folder and returns only pending migrations sqls.
   */
  // tslint:disable-next-line max-line-length
  private async readPendingMigrations(
    lastMigration: bigint
  ): Promise<MigrationEntry[]> {
    const pms = await Promise.all(
      this.modules.map((m) =>
        this.readPendingMigrationsForSingleCoreModule(m, lastMigration)
      )
    );
    return pms
      .reduce((a, b) => a.concat(b), [])
      .sort((a, b) =>
        path.basename(a.path).localeCompare(path.basename(b.path))
      );
  }

  private async readPendingMigrationsForSingleCoreModule(
    coreModule: ICoreModule<any>,
    lastMigration: bigint
  ): Promise<MigrationEntry[]> {
    const migrationsPath = path.join(coreModule.directory, 'sql', 'migrations');
    if (!fs.existsSync(migrationsPath)) {
      return [];
    }

    function matchMigrationName(file) {
      const name = file.match(/_.+\.sql$/);

      return Array.isArray(name)
        ? name[0].replace(/_/, '').replace(/\.sql$/, '')
        : null;
    }

    function matchMigrationId(file) {
      const id = file.match(/^[0-9]+/);

      return Array.isArray(id) ? BigInt(id[0]) : null;
    }

    return (
      fs
        .readdirSync(migrationsPath)
        .map((file) => ({
          id: matchMigrationId(file),
          moduleName: coreModule.name,
          name: matchMigrationName(file),
          path: path.join(migrationsPath, file),
        }))
        // only non null and existing file ending with .sql
        .filter((d) => d.id && d.name)
        .filter((d) => fs.statSync(d.path).isFile())
        .filter((d) => /\.sql$/.test(d.path))
        // Filter only pending migrations
        .filter((d) => !lastMigration || d.id > lastMigration)
    );
  }

  private async applyPendingMigrations(pendingMigrations: MigrationEntry[]) {
    for (const m of pendingMigrations) {
      this.logger.info(
        `Applying Pending migration from ${m.moduleName} - named: ${m.name}`
      );
      await this.MigrationsModel.sequelize.query(
        fs.readFileSync(m.path, { encoding: 'utf8' })
      );
    }
    return pendingMigrations;
  }

  /**
   * Inserts into `migrations` table the previous applied migrations.
   */
  private async insertAppliedMigrations(appMigrs: MigrationEntry[]) {
    for (const m of appMigrs) {
      await this.MigrationsModel.create({ id: m.id.toString(), name: m.name });
    }
  }

  /**
   * Executes 'runtime.sql' file, that set peers clock to null and state to 1.
   * @method
   * @return {function} waterCb with error
   */
  private async applyRuntimeQueryFile() {
    for (const m of this.modules) {
      const runtimePath = path.join(m.directory, 'sql', 'runtime.sql');
      if (fs.existsSync(runtimePath)) {
        this.logger.info(`Applying runtime.sql from ${m.name}`);
        await this.MigrationsModel.sequelize.query(
          fs.readFileSync(runtimePath, { encoding: 'utf8' })
        );
      }
    }
  }
}
