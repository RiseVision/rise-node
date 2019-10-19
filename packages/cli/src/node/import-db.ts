// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import fs from 'fs';
import path from 'path';
import { BACKUPS_DIR } from '../shared/constants';
import {
  checkSourceDir,
  getBackupPID,
  getNodePID,
  removeBackupLock,
  setBackupLock,
} from '../shared/fs-ops';
import { closeLog, log } from '../shared/log';
import {
  execCmd,
  execSyncAsUser,
  getBlockHeight,
  getDBEnvVars,
  hasLocalPostgres,
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

export type TOptions = IConfig &
  INetwork & { file: string; v1Backup?: boolean } & IVerbose;

export default leaf({
  commandName: 'import-db',
  description: 'Imports a DB dump using the provided config.',

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
    file: option({
      defaultValue: path.join(BACKUPS_DIR, 'latest'),
      description: 'Path to the backup file',
      nullable: false,
      typeName: 'string',
    }),
    'v1-backup': option({
      defaultValue: false,
      description: 'Provided backup file needs a migration to v2',
      nullable: false,
      typeName: 'boolean',
    }),
  },

  async action(options: TOptions) {
    const v1Backup = options['v1-backup'];
    const { config, network, file, verbose } = options;
    try {
      await nodeImportDB({ config, network, file, verbose });
    } catch (err) {
      if (verbose) {
        log(err);
      }
      log(
        'Error when importing the backup file.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function nodeImportDB({
  config,
  network,
  file,
  verbose,
}: TOptions) {
  try {
    // TODO exception
    if (!(await checkConditions(config, file))) {
      return;
    }
    setBackupLock();
    const envVars = getDBEnvVars(network, config);
    const env = { ...process.env, ...envVars };
    const database = envVars.PGDATABASE;

    await nodeStop();

    await execCmd(
      'dropdb',
      ['--if-exists', database],
      `Couldn't drop DB ${database}`,
      { env },
      verbose
    );
    await execCmd(
      'createdb',
      [database],
      `Couldn't create DB ${database}`,
      { env },
      verbose
    );
    // TODO unify with `execCmd` by piping manually
    // TODO merge with `nodeExportSnapshot`
    try {
      log('Importing the DB file...');
      const cmd = `gunzip -c "${file}" | psql > /dev/null`;
      if (verbose) {
        log(`$ ${cmd}`);
      }
      execSyncAsUser(cmd, null, { env });
    } catch (e) {
      log(`Cannot import "${file}"`);
    }
    const blockHeight = await getBlockHeight(network, config, verbose);
    log('Import completed');
    log(`Block height: ${blockHeight}`);
  } finally {
    removeBackupLock();
  }
}

// TODO exceptions
async function checkConditions(config: string | null, file: string) {
  const backupPID = getBackupPID();
  if (backupPID) {
    log(`ERROR: Active backup with PID ${backupPID}`);
    return false;
  }
  if (!fs.existsSync(file)) {
    log(`ERROR: Requested file "${file}" doesn't exist`);
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
  // TODO use nodeStop() ?
  const nodePID = getNodePID();
  if (nodePID) {
    log(`Stopping RISE Node with PID ${nodePID}`);
    await execCmd(
      'kill',
      [nodePID.toString()],
      "Couldn't kill the running node"
    );
  }
  return true;
}
