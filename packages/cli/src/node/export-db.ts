// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import * as assert from 'assert';
import * as fs from 'fs';
import { sync as mkdirpSync } from 'mkdirp';
import * as path from 'path';
import {
  BACKUP_LOCK_FILE,
  BACKUPS_DIR,
  checkNodeDirExists,
  execCmd,
  extractRiseNodeFile,
  getBackupLockFile,
  getBackupPID,
  getBackupsDir,
  hasLocalPostgres,
  log,
  mergeConfig,
  NETWORKS,
  NODE_DIR,
  TNetworkType,
} from '../misc';
import nodeStop from './stop';

export default leaf({
  commandName: 'export-db',
  description: `Creates a DB dump using the provided config and places it in ./${BACKUPS_DIR}.`,

  options: {
    config: option({
      defaultValue: `${NODE_DIR}/config.json`,
      description: 'Path to the config file',
      nullable: true,
      typeName: 'string',
    }),
    network: option({
      allowedValues: NETWORKS,
      defaultValue: 'mainnet',
      nullable: true,
      typeName: 'string',
    }),
  },

  async action({ config, network }: { config: string; network: TNetworkType }) {
    if (!checkConditions(config)) {
      return false;
    }
    fs.writeFileSync(BACKUP_LOCK_FILE, process.pid);
    mkdirpSync(getBackupsDir());
    const mergedConfig = mergeConfig(config, network);
    const { host, port, database, user, password } = mergedConfig.db;
    const targetDB = `${database}_snap`;
    assert(host);
    assert(port);
    assert(database);
    assert(password);

    const envVars = {
      PGDATABASE: database,
      PGHOST: host,
      PGPASSWORD: password,
      PGPORT: port.toString(),
      PGUSER: user,
    };

    await nodeStop.action({});

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
      const backupName = `backup_${database}_${backupHeight}.gz`;
      // const latestBackupName = `latest`;
      const backupPath = path.resolve(getBackupsDir(), backupName);
      execCmd(
        `pg_dump -O "${targetDB}" | gzip > ${backupPath}`,
        "Couldn't dump the DB",
        envVars
      );

      execCmd(
        `ln -s "${backupPath}" "${path.resolve(getBackupsDir(), 'latest')}"`,
        `Couldn't symlink the backup file to ${getBackupsDir()}/latest`
      );
      console.log(`Created a backup file ${getBackupsDir()}/${backupName}.`);
    } catch (e) {
      console.log('Error when creating a backup');
    }
    fs.unlinkSync(BACKUP_LOCK_FILE);
  },
});

function checkConditions(config: string) {
  const pid = getBackupPID();
  if (pid) {
    console.log(`ERROR: Active backup in PID ${pid}`);
  }
  if (!hasLocalPostgres()) {
    console.log('ERROR: PostgreSQL not installed');
    return false;
  }
  if (!fs.existsSync(config)) {
    console.log(`ERROR: Config file doesn't exist.\n${config}`);
    return false;
  }
  if (!checkNodeDirExists(true)) {
    extractRiseNodeFile();
  }
  if (fs.existsSync(getBackupLockFile())) {
    console.log(
      `ERROR: Lock file ${getBackupLockFile()} exists.` +
        'Remove it to continue.'
    );
    return false;
  }
  // TODO stop the node (or a container)
  // if (getPID()) {
  //   console.log('TODO stop the running ndoe');
  //   return false;
  // }
  return true;
}
