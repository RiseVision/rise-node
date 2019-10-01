// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { nodeStop } from '../node/stop';
import {
  DB_DATA_DIR,
  DB_LOCK_FILE,
  DB_LOG_FILE,
  DB_PG_CTL,
} from '../shared/constants';
import { checkSourceDir, getPID } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  dbConnectionInfo,
  execCmd,
  getDBEnvVars,
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

export type TOptions = INetwork & IConfig & IVerbose;

export default leaf({
  commandName: 'start',
  description: 'Start a DB instance defined in the config',
  options: {
    ...configOption,
    ...verboseOption,
    ...networkOption,
  },

  async action({ config, network, verbose }: TOptions) {
    try {
      await dbStart({ config, network, verbose });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nError while starting the DB.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function dbStart({ config, network, verbose }: TOptions) {
  await checkSourceDir(true);
  if (getPID(DB_LOCK_FILE)) {
    log('DB already running');
    return;
  }
  if (verbose) {
    printUsingConfig(network, config);
  }

  const envVars = getDBEnvVars(network, config, true);
  const env = { ...process.env, ...envVars };

  log('Starting the DB...\n' + verbose ? dbConnectionInfo(envVars) : '');

  await nodeStop();

  debug(envVars);

  await execCmd(
    DB_PG_CTL,
    ['-D', DB_DATA_DIR, '-l', DB_LOG_FILE, 'start'],
    `Examine the log using --verbose and check ${DB_LOG_FILE}.`,
    { env },
    verbose
  );

  log('\nDB started');
}
