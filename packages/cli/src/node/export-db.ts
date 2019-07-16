// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { sync as mkdirpSync } from 'mkdirp';
import * as path from 'path';
import {
  BACKUPS_DIR,
  checkNodeDirExists,
  execCmd,
  extractSourceFile,
  getBackupPID,
  getBackupsDir,
  getBlockHeight,
  getDBEnvVars,
  getNodePID,
  hasLocalPostgres,
  log,
  printUsingConfig,
  removeBackupLock,
  setBackupLock,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IShowLogs,
  networkOption,
  showLogsOption,
} from '../shared/options';
import { nodeStop } from './stop';

export type TOptions = IConfig & INetwork & IShowLogs;

export default leaf({
  commandName: 'export-db',
  description: `Creates a DB dump using the provided config and places it in ./${BACKUPS_DIR}.`,

  options: {
    ...configOption,
    ...networkOption,
    ...showLogsOption,
  },

  async action({ config, network, show_logs }: TOptions) {
    if (!(await checkConditions(config))) {
      return;
    }
    printUsingConfig(network, config);
    setBackupLock();
    mkdirpSync(getBackupsDir());
    const envVars = getDBEnvVars(network, config);
    const env = { ...process.env, ...envVars };
    const database = envVars.PGDATABASE;
    // TODO drop the _snap db after exporting?
    const targetDB = `${database}_snap`;

    nodeStop(false);

    log(envVars);

    try {
      await execCmd(
        'dropdb',
        ['--if-exists', targetDB],
        `Cannot drop ${targetDB}`,
        { env },
        show_logs
      );
      await execCmd(
        'vacuumdb',
        ['--analyze', '--full', database],
        `Cannot vacuum ${database}`,
        { env },
        show_logs
      );
      await execCmd(
        'createdb',
        [targetDB],
        `Cannot createdb ${targetDB}`,
        { env },
        show_logs
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
        `Couldn't symlink ${process.cwd()}/latest to the backup file`,
        {
          cwd: getBackupsDir(),
        }
      );
      console.log(`Created a DB backup file "./${backupName}".`);
    } catch (e) {
      console.log('Error when creating the backup file');
      console.log(
        '\nError when creating the backup file.\n' +
          'Examine the log using --show_logs.'
      );
      process.exit(1);
    }
    removeBackupLock();
  },
});

async function checkConditions(config: string | null) {
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
  if (!checkNodeDirExists(true)) {
    await extractSourceFile();
  }
  // TODO use nodeStop() ?
  const nodePID = getNodePID();
  if (nodePID) {
    console.log(`Stopping RISE node with PID ${nodePID}`);
    await execCmd(
      'kill',
      [nodePID.toString()],
      "Couldn't kill the running node"
    );
  }
  return true;
}
