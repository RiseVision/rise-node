// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { sync as mkdirpSync } from 'mkdirp';
import path from 'path';
import os from 'os';
import { BACKUPS_DIR } from '../shared/constants';
import { ConditionsNotMetError } from '../shared/exceptions';
import {
  checkSourceDir,
  getBackupPID,
  getBackupsDir,
  removeBackupLock,
  setBackupLock,
} from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  checkConfigFile,
  execCmd,
  getBlockHeight,
  getDBEnvVars,
  hasLocalPostgres,
  printUsingConfig,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';
import { nodeStop } from './stop';

export type TOptions = IConfig & INetwork & IVerbose;

export default leaf({
  commandName: 'export-db',
  description: `Creates a DB dump using the provided config and places it in ./${BACKUPS_DIR}.`,

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
  },

  async action({ config, network, verbose }: TOptions) {
    try {
      await nodeExportDB({ config, network, verbose });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        'Error when creating a backup file.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function nodeExportDB({ config, network, verbose }: TOptions) {
  try {
    await checkConditions({ config });
    if (verbose) {
      printUsingConfig(network, config);
    }
    setBackupLock();
    mkdirpSync(getBackupsDir());
    const envVars = getDBEnvVars(network, config);
    const env = { ...process.env, ...envVars };
    const database = envVars.PGDATABASE;
    // TODO drop the _snap db after exporting?
    const targetDB = `${database}_snap`;

    await nodeStop();

    debug(envVars);
    log('Starting the export...');

    await execCmd(
      'dropdb',
      ['--if-exists', targetDB],
      `Cannot drop ${targetDB}`,
      { env },
      verbose
    );
    await execCmd(
      'vacuumdb',
      ['--analyze', '--full', database],
      `Cannot vacuum ${database}`,
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
    // TODO unify with `execCmd` by piping manually
    try {
      log('Exporting the DB...');
      const cmd = `pg_dump "${database}" | psql "${targetDB}"`;
      if (verbose) {
        log(`$ ${cmd}`);
      }
      execSync(cmd, { env });
    } catch (e) {
      log(`Cannot copy ${database} to ${targetDB}`);
    }

    const blockHeight = await getBlockHeight(network, config);
    if (!blockHeight) {
      throw new Error("ERROR: Couldn't get the block height");
    }

    const backupName = `backup_${database}_${blockHeight}.gz`;
    const backupPath = path.resolve(getBackupsDir(), backupName);
    // TODO unify with `execCmd` by piping manually
    try {
      execSync(`pg_dump -O "${targetDB}" | gzip > ${backupPath}`, {
        env,
      });
    } catch (e) {
      log("Couldn't dump the DB");
    }

    // link the `latest` file
    await execCmd(
      'ln',
      ['-sf', backupName, 'latest'],
      `Couldn't symlink ${getBackupsDir()}/latest to the backup file`,
      {
        cwd: getBackupsDir(),
      }
    );
    // cleanup
    await execCmd(
      'dropdb',
      ['--if-exists', targetDB],
      `Cannot drop ${targetDB}`,
      { env },
      verbose
    );

    log(`Created a DB backup file "${BACKUPS_DIR}/${backupName}".`);
  } finally {
    removeBackupLock();
  }
}

async function checkConditions({ config }: IConfig) {
  // TODO extract checkActivePID(TYPE)
  const backupPID = getBackupPID();
  if (backupPID) {
    throw new ConditionsNotMetError(
      `Active backup process with PID ${backupPID}`
    );
  }
  if (!hasLocalPostgres()) {
    throw new ConditionsNotMetError('PostgreSQL not installed');
  }
  checkConfigFile(config);
  await checkSourceDir();
}
