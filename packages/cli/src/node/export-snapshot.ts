// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { sync as mkdirpSync } from 'mkdirp';
import path from 'path';
import { util } from 'protobufjs';
import { BACKUPS_DIR } from '../shared/constants';
import {
  checkSourceDir,
  getBackupsDir,
  getSnapshotPID,
  removeBackupLock,
} from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  execCmd,
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
import fs = util.fs;

export type TOptions = IConfig & INetwork & IVerbose;

export default leaf({
  commandName: 'export-snapshot',
  description: `Creates an optimized database snapshot using the provided config and places it in ./${BACKUPS_DIR}.`,

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
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
    removeBackupLock();
  },
});

export async function nodeExportSnapshot({
  config,
  network,
  verbose,
}: TOptions) {
  if (!(await checkConditions({ config }))) {
    // TODO throw in checkConditions
    throw new Error('Preconditions not met');
  }
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
  // TODO drop the _snap db after exporting?
  const targetDB = `${database}_snap`;
  await execCmd(
    'dropdb',
    ['--if-exists', targetDB],
    `Cannot drop ${targetDB}`,
    { env },
    verbose
  );
  await execCmd(
    'createdb',
    [targetDB],
    `Cannot createdb ${targetDB}`,
    { env },
    verbose
  );

  // import the exported file
  log('Importing the backup file...');
  // TODO unify with others by piping manually
  const backupPath = path.resolve(getBackupsDir(), 'latest');
  try {
    execSync(`gunzip -c "${backupPath}" | psql "${targetDB}" > /dev/null`, {
      env,
    });
  } catch (e) {
    log(`Cannot import "${backupPath}" into the snap DB`);
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
  const name = `snap_${network}_${height}.gz`;
  const snapshotPath = path.resolve(getBackupsDir(), name);
  // TODO unify with others by piping manually
  try {
    execSync(`pg_dump -O "${targetDB}" | gzip > ${snapshotPath}`, {
      env,
    });
  } catch (e) {
    log("Couldn't dump the DB");
  }

  log('Snapshot ready, removing the temp DB');
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
}

// TODO change to exceptions
async function checkConditions({ config }: IConfig) {
  const pid = getSnapshotPID();
  if (pid) {
    log(`ERROR: Active backup with PID ${pid}`);
    return false;
  }
  if (!hasLocalPostgres()) {
    log('ERROR: PostgreSQL not installed');
    return false;
  }
  if (config && !fs.existsSync(config)) {
    log(`ERROR: Config file doesn't exist.\n${config}`);
    return false;
  }
  await checkSourceDir();
  return true;
}
