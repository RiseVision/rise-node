import * as monitor from 'pg-monitor';
import * as pgPromise from 'pg-promise';
import { IDatabase } from 'pg-promise';
import { AppConfigDatabase } from '../types/genericTypes';
import { ILogger } from './logger';
import { Migrator} from './migrator';

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
