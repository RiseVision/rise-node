// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import path from 'path';
import {
  DB_DATA_DIR,
  DB_LOCK_FILE,
  DB_LOG_FILE,
  DB_PG_PATH,
  POSTGRES_HOME,
} from '../shared/constants';
import { ConditionsNotMetError, handleCLIError } from '../shared/exceptions';
import { checkSourceDir, getPID } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  execCmd,
  getDBEnvVars,
  getUsername,
  isLinux,
  isSudo,
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
    // TODO remove --config
    ...configOption,
    ...verboseOption,
    // TODO remove --network
    ...networkOption,
  },

  async action({ config, network, verbose }: TOptions) {
    try {
      await dbStop({ config, network, verbose });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nError while stopping the DB.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function dbStop({ config, network, verbose }: TOptions) {
  try {
    await checkSourceDir(true);
    if (!getPID(DB_LOCK_FILE)) {
      log('DB not running');
      return;
    }
    if (isLinux() && getUsername() !== 'postgres' && !isSudo()) {
      throw new ConditionsNotMetError(
        `Run this command with sudo:\n$ sudo ${getCmd({
          config,
          network,
        })}`
      );
    }
    if (verbose) {
      printUsingConfig(network, config);
    }

    const envVars = getDBEnvVars(network, config, true);
    const env = { ...process.env, ...envVars };

    debug(envVars);

    await execCmd(
      DB_PG_PATH + 'pg_ctl',
      ['-D', DB_DATA_DIR, '-l', DB_LOG_FILE, 'stop'],
      "Couldn't stop the DB.",
      { ...getCwd(), env },
      verbose,
      null,
      // run as the postgres user
      isLinux() ? 'postgres' : null
    );

    log('DB stopped');
  } catch (err) {
    handleCLIError(err);
  }
}

function getCmd({ config, network }: TOptions): string {
  let cmd = './rise db start';
  if (config) {
    cmd += ` --config ${path.resolve(__dirname, config)}`;
  }
  if (network !== 'mainnet') {
    cmd += ` --network ${network}`;
  }
  return cmd;
}

function getCwd() {
  return isLinux() ? { cwd: POSTGRES_HOME } : undefined;
}
