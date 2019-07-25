// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import {
  DB_DATA_DIR,
  DB_LOCK_FILE,
  DB_LOG_FILE,
  DB_PG_CTL,
} from '../shared/constants';
import {
  checkSourceDir,
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
  commandName: 'stop',
  description: 'Stop a DB instance defined in the config',
  options: {
    ...configOption,
    ...verboseOption,
    ...networkOption,
  },

  async action({ config, network, verbose }: TOptions) {
    try {
      await dbStop({ config, network, verbose });
    } catch (err) {
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nError while stopping the DB.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function dbStop({ config, network, verbose }: TOptions) {
  await checkSourceDir(true);
  if (!getPID(DB_LOCK_FILE)) {
    console.log('DB not running');
    return;
  }
  if (verbose) {
    printUsingConfig(network, config);
  }

  const envVars = getDBEnvVars(network, config, true);
  const env = { ...process.env, ...envVars };

  log(envVars);

  await execCmd(
    DB_PG_CTL,
    ['-D', DB_DATA_DIR, '-l', DB_LOG_FILE, 'stop'],
    "Couldn't stop the DB.",
    { env },
    verbose
  );

  console.log('DB stopped');
}
