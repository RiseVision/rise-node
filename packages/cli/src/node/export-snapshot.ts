// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { sync as mkdirpSync } from 'mkdirp';
import path from 'path';
import { BACKUPS_DIR } from '../shared/constants';
import { ConditionsNotMetError } from '../shared/exceptions';
import {
  checkSourceDir,
  getBackupsDir,
  getSnapshotPID,
  removeSnapshotLock,
  setSnapshotLock,
} from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  checkConfigFile,
  execCmd,
  execSyncAsUser,
  getBlockHeight,
  getDBEnvVars,
  hasLocalPostgres,
  printUsingConfig,
  runSQL,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';
import { nodeExportDB } from './export-db';
import { nodeStart } from './start';

export type TOptions = IConfig & INetwork & IVerbose;

export default leaf({
  commandName: 'export-snapshot',
  description: `Creates an optimized database snapshot using the provided config and places it in ./${BACKUPS_DIR}.`,

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
    // TODO --file options, which points to backup (to avoid exporting the db)
  },

  async action({ config, network, verbose }: TOptions) {
    try {
      await nodeExportSnapshot({ config, network, verbose });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        'Error when creating a snapshot file.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

/**
 * TODO copy directly from `rise_db` to `rise_db_snap` to avoid the FS
 * @param config
 * @param network
 * @param verbose
 */
export async function nodeExportSnapshot({
  config,
  network,
  verbose,
}: TOptions) {
  try {
    await checkConditions({ config });
    setSnapshotLock();
    // export the DB
    await nodeExportDB({ config, network, verbose });
    if (verbose) {
      printUsingConfig(network, config);
    }
    // setSnapshotLock();
    mkdirpSync(getBackupsDir());

    // prepare the temp DB
    log('Prepering the temp DB...');
    const envVars = getDBEnvVars(network, config);
    let env = { ...process.env, ...envVars };
    const database = envVars.PGDATABASE;
    env = { ...env, PGDATABASE: null };
    const targetDB = `${database}_snap`;
    // TODO extract
    await execCmd(
      'dropdb',
      ['--if-exists', targetDB],
      `Cannot drop ${targetDB}`,
      { env },
      verbose
    );
    // TODO extract
    await execCmd(
      'createdb',
      [targetDB],
      `Cannot createdb ${targetDB}`,
      {
        env,
      },
      verbose
    );

    // TODO merge with `nodeImportDB()`
    // import the exported file
    // TODO unify with others by piping manually
    const backupPath = path.resolve(getBackupsDir(), 'latest');
    try {
      log('Importing the DB file...');
      const cmd = `gunzip -c "${backupPath}" | psql "${targetDB}" > /dev/null`;
      if (verbose) {
        log(`$ ${cmd}`);
      }
      execSyncAsUser(cmd, null, { env });
    } catch (e) {
      log(`Cannot import "${backupPath}" into the snap DB`);
      throw e;
    }
    await runSQL('delete from exceptions;', network, config, verbose, targetDB);

    log('Verifying the snapshot...');
    await nodeStart({
      config,
      foreground: true,
      network,
      verbose,
      verifySnapshot: true,
    });
    log('Snapshot verification OK!');

    // clean the snap db
    log('Cleaning up the snapshot DB');
    await runSQL('delete from peers;', network, config, verbose, targetDB);
    await runSQL('delete from info;', network, config, verbose, targetDB);
    await runSQL('delete from exceptions;', network, config, verbose, targetDB);

    await execCmd(
      'vacuumdb',
      ['--analyze', '--full', targetDB],
      `Cannot vacuum ${database}`,
      { env },
      verbose
    );

    const height = await getBlockHeight(network, config, verbose, targetDB);
    // TODO extract for `nodeDownloadSnapshot`
    const name = `snap_${network}_${height}.gz`;
    const snapshotPath = path.resolve(getBackupsDir(), name);
    // TODO unify with `execCmd` by piping manually
    try {
      const cmd = `pg_dump -O "${targetDB}" | gzip > ${snapshotPath}`;
      log('Exporting the DB..');
      log(`$ ${cmd}`);
      execSyncAsUser(cmd, null, { env });
    } catch (e) {
      log("Couldn't dump the DB");
      throw e;
    }

    log('Snapshot ready, removing the temp DB');
    // TODO extract
    await execCmd(
      'dropdb',
      ['--if-exists', targetDB],
      `Cannot drop ${targetDB}`,
      { env },
      verbose
    );

    log(`Snapshot's height: ${height}`);
    log(`Created a DB snapshot file:\n"${BACKUPS_DIR}/${name}".`);

    // TODO show times
    // TODO split to smaller functions
  } finally {
    removeSnapshotLock();
  }
}

async function checkConditions({ config }: IConfig) {
  const pid = getSnapshotPID();
  if (pid) {
    throw new ConditionsNotMetError(`Active snapshot process with PID ${pid}`);
  }
  if (!hasLocalPostgres()) {
    throw new ConditionsNotMetError('PostgreSQL not installed');
  }
  checkConfigFile(config);
  await checkSourceDir();
}
