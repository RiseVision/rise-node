// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
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
  getDBVars,
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
  networkOption,
} from '../shared/options';
import { nodeStop } from './stop';

export type TOptions = IConfig & INetwork;

export default leaf({
  commandName: 'export-db',
  description: `Creates a DB dump using the provided config and places it in ./${BACKUPS_DIR}.`,

  options: {
    ...configOption,
    ...networkOption,
  },

  async action({ config, network }: TOptions) {
    if (!checkConditions(config)) {
      return;
    }
    printUsingConfig(network, config);
    setBackupLock();
    mkdirpSync(getBackupsDir());
    const envVars = getDBVars(network, config);
    const database = envVars.PGDATABASE;
    // TODO drop the _snap db after exporting?
    const targetDB = `${database}_snap`;

    nodeStop(false);

    log(envVars);

    try {
      execCmd(
        `dropdb --if-exists "${targetDB}"`,
        `Cannot drop ${targetDB}`,
        envVars
      );
      execCmd(
        `vacuumdb --analyze --full "${database}"`,
        `Cannot vacuum ${database}`,
        envVars
      );
      execCmd(`createdb "${targetDB}"`, `Cannot createdb ${targetDB}`, envVars);
      execCmd(
        `pg_dump "${database}" | psql "${targetDB}"`,
        `Cannot copy ${database} to ${targetDB}`,
        envVars
      );

      const backupHeight = parseInt(
        execCmd(
          `psql -d "${targetDB}" -t -c 'select height from blocks order by height desc limit 1;' | xargs`,
          "Couldn't get the block height",
          envVars
        ),
        10
      );
      log(`backupHeight: ${backupHeight}`);
      if (!backupHeight) {
        throw new Error("ERROR: Couldn't get the block height");
      }
      const backupName = `backup_${database}_${backupHeight}.gz`;
      // const latestBackupName = `latest`;
      const backupPath = path.resolve(getBackupsDir(), backupName);
      execCmd(
        `pg_dump -O "${targetDB}" | gzip > ${backupPath}`,
        "Couldn't dump the DB",
        envVars
      );

      // link the `latest` file
      execCmd(
        `ln -sf ${backupName} latest`,
        `Couldn't symlink ${process.cwd()}/latest to the backup file`,
        null,
        { cwd: getBackupsDir() }
      );
      console.log(`Created a DB backup file "./${backupName}".`);
    } catch (e) {
      console.log('Error when creating the backup file');
    }
    removeBackupLock();
  },
});

function checkConditions(config: string | null) {
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
    extractSourceFile();
  }
  const nodePID = getNodePID();
  if (nodePID) {
    console.log(`Stopping RISE node with PID ${nodePID}`);
    execCmd(`kill ${nodePID}`, "Couldn't kill the running node");
  }
  return true;
}
