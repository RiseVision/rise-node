// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import path from 'path';
import { nodeStop } from '../node/stop';
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
  dbConnectionInfo,
  execCmd,
  getDBEnvVars,
  getUsername,
  isLinux,
  isSudo,
  printUsingConfig,
} from '../shared/misc';
import {
  configOption,
  crontabOption,
  IConfig,
  ICrontab,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';
import { dbCrontab } from './crontab';

export type TOptions = INetwork & IConfig & IVerbose & ICrontab;

export default leaf({
  commandName: 'start',
  description: 'Start a DB instance defined in the config',
  options: {
    ...configOption,
    ...verboseOption,
    ...networkOption,
    ...crontabOption,
  },

  async action({ config, network, verbose, crontab }: TOptions) {
    try {
      await dbStart({ config, network, verbose, crontab });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nError while starting the DB.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function dbStart({ config, network, verbose, crontab }: TOptions) {
  try {
    // TODO verify that postgres user exists when on linux
    await checkSourceDir(true);
    if (getPID(DB_LOCK_FILE)) {
      log('DB already running');
      return;
    }

    if (isLinux() && getUsername() !== 'postgres' && !isSudo()) {
      debug(`getUsername() ${getUsername()}`);
      debug(`isSudo() ${isSudo()}`);
      throw new ConditionsNotMetError(
        `Run this command with sudo:\n$ sudo ${getCmd({ config, network })}`
      );
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
      DB_PG_PATH + 'pg_ctl',
      ['-D', DB_DATA_DIR, '-l', DB_LOG_FILE, 'start'],
      `Failed to start the DB, check ${DB_LOG_FILE}.`,
      { env, ...getCwd() },
      verbose,
      null,
      // run as the postgres user
      isLinux() ? 'postgres' : null
    );

    log('\nDB started');

    // add the crontab entry if requested
    if (crontab) {
      await dbCrontab({ verbose, config, network });
    }
  } catch (err) {
    handleCLIError(err);
  }
}

function getCmd({ config, network, crontab }: TOptions): string {
  let cmd = './rise db start';
  if (config) {
    cmd += ` --config ${path.resolve(__dirname, config)}`;
  }
  if (network !== 'mainnet') {
    cmd += ` --network ${network}`;
  }
  if (crontab) {
    cmd += ' --crontab';
  }
  return cmd;
}

function getCwd() {
  return isLinux() ? { cwd: POSTGRES_HOME } : undefined;
}
