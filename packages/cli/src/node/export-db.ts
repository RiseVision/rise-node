// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import fs from 'fs';
import { sync as mkdirpSync } from 'mkdirp';
import path from 'path';
import { BACKUPS_DIR } from '../shared/constants';
import {
  checkSourceDir,
  getBackupsDir,
  removeBackupLock,
  setBackupLock,
} from '../shared/fs-ops';
import {
  execCmd,
  getBackupPID,
  getBlockHeight,
  getDBEnvVars,
  hasLocalPostgres,
  log,
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
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        'Error when creating the backup file.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
    removeBackupLock();
  },
});

export async function nodeExportDB({ config, network, verbose }: TOptions) {
  if (!(await checkConditions({ config }))) {
    return;
  }
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

  await nodeStop({ verbose });

  log(envVars);
  console.log('Starting the export...');

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
  // TODO unify with others by piping manually
  try {
    execSync(`pg_dump "${database}" | psql "${targetDB}"`, {
      env,
    });
  } catch (e) {
    console.log(`Cannot copy ${database} to ${targetDB}`);
  }

  const blockHeight = await getBlockHeight(network, config);
  if (!blockHeight) {
    throw new Error("ERROR: Couldn't get the block height");
  }

  const backupName = `backup_${database}_${blockHeight}.gz`;
  const backupPath = path.resolve(getBackupsDir(), backupName);
  // TODO unify with others by piping manually
  try {
    execSync(`pg_dump -O "${targetDB}" | gzip > ${backupPath}`, {
      env,
    });
  } catch (e) {
    console.log("Couldn't dump the DB");
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
  console.log(`Created a DB backup file "${BACKUPS_DIR}/${backupName}".`);
}

async function checkConditions({ config }: IConfig) {
  const backupPID = getBackupPID();
  if (backupPID) {
    console.log(`ERROR: Active backup with PID ${backupPID}`);
    return false;
  }
  if (!hasLocalPostgres()) {
    console.log('ERROR: PostgreSQL not installed');
    return false;
  }
  if (config && !fs.existsSync(config)) {
    console.log(`ERROR: Config file doesn't exist.\n${config}`);
    return false;
  }
  await checkSourceDir();
  return true;
}
