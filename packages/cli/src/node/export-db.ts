// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import * as assert from 'assert';
import * as fs from 'fs';
import { sync as mkdirpSync } from 'mkdirp';
import * as path from 'path';
import {
  BACKUPS_DIR,
  checkNodeDirExists,
  execCmd,
  extractRiseNodeFile,
  getBackupLockFile,
  getBackupsDir,
  hasLocalPostgres,
  log,
  mergeConfig,
  NETWORKS,
  NODE_DIR,
  TNetworkType,
} from '../misc';

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
    // TODO create a BACKUP_LOCK_FILE
    mkdirpSync(getBackupsDir());
    const mergedConfig = mergeConfig(config, network);
    const { host, port, database, user, password } = mergedConfig.db;
    const targetDB = `${database}_snap`;
    assert(host);
    assert(port);
    assert(database);
    assert(password);

    // tslint:disable object-literal-sort-keys
    const envVars = {
      PGPORT: port.toString(),
      PGHOST: host,
      PGUSER: user,
      PGPASSWORD: password,
      PGDATABASE: database,
    };
    // tslint:enable object-literal-sort-keys

    // TODO catch exceptions and print a nice msg
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

    // TODO start the node

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
    execCmd(
      `pg_dump -O "${targetDB}" | gzip > ${path.resolve(
        getBackupsDir(),
        backupName
      )}`,
      "Couldn't dump the DB",
      envVars
    );

    // TODO symlink the latest backup
    console.log(`Created a backup file ${getBackupsDir()}/${backupName}.`);
    // TODO remove BACKUP_LOCK_FILE
  },
});

function checkConditions(config: string) {
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
