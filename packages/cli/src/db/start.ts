// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { nodeStop } from '../node/stop';
import {
  checkNodeDirExists,
  cmdSilenceString,
  DB_DATA_DIR,
  DB_LOCK_FILE,
  DB_LOG_FILE,
  execCmd,
  extractSourceFile,
  getDBVars,
  getPID,
  log,
  printUsingConfig,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IShowLogs,
  networkOption,
  showLogsOption,
} from '../shared/options';

export type TOptions = INetwork & IConfig & IShowLogs;

export default leaf({
  commandName: 'start',
  description: 'Start a DB instance defined in the config',
  options: {
    ...configOption,
    ...showLogsOption,
    ...networkOption,
  },

  async action({ config, network, show_logs }: TOptions) {
    try {
      await dbStart({ config, network, show_logs });
    } catch {
      console.log(
        '\nError while starting the DB. Examine the log using --show_logs.'
      );
      process.exit(1);
    }
  },
});

export async function dbStart({ config, network, show_logs }: TOptions) {
  if (!checkNodeDirExists(true)) {
    extractSourceFile();
  }
  if (getPID(DB_LOCK_FILE)) {
    console.log('DB already running');
    return;
  }
  printUsingConfig(network, config);

  const silent = show_logs ? '' : cmdSilenceString;
  const envVars = getDBVars(network, config);

  console.log(
    'Starting the DB...\n' +
      `Host: ${envVars.PGHOST}\n` +
      `Port: ${envVars.PGPORT}`
  );

  nodeStop(false);

  log(envVars);

  execCmd(
    `pg_ctl -D ${DB_DATA_DIR} -l ${DB_LOG_FILE} start ${silent}`,
    `Examine the log using --show_logs and check ${DB_LOG_FILE}.`,
    envVars
  );

  console.log('DB started');
}
