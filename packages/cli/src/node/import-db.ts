// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import * as fs from 'fs';
import * as path from 'path';
import {
  BACKUPS_DIR,
  checkNodeDirExists,
  execCmd,
  extractSourceFile,
  getBackupPID,
  getDBVars,
  getNodePID,
  hasLocalPostgres,
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

export type TOptions = IConfig & INetwork & { file: string };

export default leaf({
  commandName: 'import-db',
  description: 'Imports a DB dump using the provided config.',

  options: {
    ...configOption,
    ...networkOption,
    file: option({
      defaultValue: path.join(BACKUPS_DIR, 'latest'),
      description: 'Path to the backup file',
      nullable: false,
      typeName: 'string',
    }),
  },

  async action({ config, network, file }: TOptions) {
    if (!checkConditions(config, file)) {
      return;
    }
    setBackupLock();
    const envVars = getDBVars(network, config);
    const database = envVars.PGDATABASE;

    nodeStop(false);

    try {
      // TODO extract to `db init`
      execCmd(
        `dropdb --if-exists ${database}`,
        `Couldn't drop DB ${database}`,
        envVars
      );
      execCmd(
        `createdb ${database}`,
        `Couldn't create DB ${database}`,
        envVars
      );
      // extract end
      execCmd(
        `gunzip -c "${file}" | psql > /dev/null`,
        `Cannot import "${file}"`,
        envVars
      );
      console.log(`Imported "./${file}" into the DB.`);
    } catch (e) {
      console.log('Error when importing the backup file');
    }
    removeBackupLock();
  },
});

function checkConditions(config: string | null, file: string) {
  const backupPID = getBackupPID();
  if (backupPID) {
    console.log(`ERROR: Active backup with PID ${backupPID}`);
    return false;
  }
  if (!fs.existsSync(file)) {
    console.log(`ERROR: Requested file "${file}" doesn't exist`);
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
