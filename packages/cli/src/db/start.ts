// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { nodeStop } from '../node/stop';
import {
  DB_DATA_DIR,
  DB_LOCK_FILE,
  DB_LOG_FILE,
  DB_PG_CTL,
} from '../shared/constants';
import {
  checkSourceDir,
  dbConnectionInfo,
  execCmd,
  getDBEnvVars,
  getPID,
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
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nError while starting the DB.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function dbStart({ config, network, verbose }: TOptions) {
  await checkSourceDir(true);
  if (getPID(DB_LOCK_FILE)) {
    console.log('DB already running');
    return;
  }
  if (verbose) {
    printUsingConfig(network, config);
  }

  const envVars = getDBEnvVars(network, config, true);
  const env = { ...process.env, ...envVars };

  console.log('Starting the DB...\n' + dbConnectionInfo(envVars));

  await nodeStop({ verbose });

  log(envVars);

  await execCmd(
    DB_PG_CTL,
    ['-D', DB_DATA_DIR, '-l', DB_LOG_FILE, 'start'],
    `Examine the log using --verbose and check ${DB_LOG_FILE}.`,
    { env },
    verbose
  );

  console.log('\nDB started');
}
