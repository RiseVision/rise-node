// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import delay from 'delay';
import path from 'path';
import { nodeStop } from '../node/stop';
import {
  DB_DATA_DIR,
  DB_LOG_FILE,
  DB_PG_PATH,
  POSTGRES_HOME,
  SEC,
} from '../shared/constants';
import {
  ConditionsNotMetError,
  NoRiseDistFileError,
} from '../shared/exceptions';
import { checkSourceDir } from '../shared/fs-ops';
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
import { dbCrontab } from './crontab';
import { dbStart } from './start';
import { dbStop } from './stop';

export type TOptions = INetwork & IConfig & IVerbose;

export default leaf({
  commandName: 'init',
  description: 'Initialize a fresh DB and start it',
  options: {
    ...configOption,
    ...verboseOption,
    ...networkOption,
  },

  async action({ config, network, verbose }: TOptions) {
    try {
      await dbInit({ config, network, verbose });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      if (!(err instanceof NoRiseDistFileError)) {
        let cmd = path.resolve(__dirname, 'rise') + ' db init';
        if (config) {
          cmd += ` --config=${config}`;
        }
        if (network !== 'mainnet') {
          cmd += ` --network=${network}`;
        }

        log(
          '\nError while initializing a PostgreSQL database.\n' +
            // getLinuxHelpMsg(config, network) +
            `\nExamine the log using --verbose and check ${DB_LOG_FILE}.`
        );
      }
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function dbInit({ config, network, verbose }: TOptions) {
  await checkSourceDir(true);
  if (verbose) {
    printUsingConfig(network, config);
  }

  if (isLinux() && getUsername() !== 'postgres' && !isSudo()) {
    throw new ConditionsNotMetError(
      `Run this command with sudo:\n$ sudo ${getCmd({ config, network })}`
    );
  }

  const envVars = getDBEnvVars(network, config, true);
  const env = { ...process.env, ...envVars };
  const envHostPort = {
    ...process.env,
    PGHOST: envVars.PGHOST,
    PGPORT: envVars.PGPORT,
  };

  // stop the node and DB
  await nodeStop();
  await dbStop({ config, network, verbose });

  debug(envVars);

  await execCmd(
    'rm',
    ['-Rf', DB_DATA_DIR],
    `Couldn't remove the data dir ${DB_DATA_DIR}.`,
    { env, ...getCwd() },
    verbose,
    null,
    // run as the postgres user
    isLinux() ? 'postgres' : null
  );

  await execCmd(
    DB_PG_PATH + 'pg_ctl',
    ['init', '-D', DB_DATA_DIR],
    `Couldn't init a new DB data dir in ${DB_DATA_DIR}.`,
    { env, ...getCwd() },
    verbose,
    null,
    // run as the postgres user
    isLinux() ? 'postgres' : null
  );

  await dbCrontab({ verbose, network, config });
  await delay(2 * SEC);

  // start the DB
  await dbStart({ config, network, verbose });
  // wait just in case
  await delay(3 * SEC);

  // optionally add the user
  try {
    await execCmd(
      DB_PG_PATH + 'createuser',
      ['--superuser', envVars.PGUSER],
      `Couldn't create a new user ${envVars.PGUSER}.`,
      {
        ...getCwd(),
        env: envHostPort,
      },
      verbose,
      null,
      // run as the postgres user
      isLinux() ? 'postgres' : null
    );
  } catch (err) {
    const alreadyExists = err
      .toString()
      .includes(`role "${envVars.PGUSER}" already exists`);
    // skip if the error was about the user already existing
    if (!alreadyExists) {
      throw err;
    }
  }

  await execCmd(
    DB_PG_PATH + 'createdb',
    [envVars.PGDATABASE],
    `Couldn't create a new database ${envVars.PGDATABASE}.`,
    {
      ...getCwd(),
      env: envHostPort,
    },
    verbose,
    null,
    // run as the postgres user
    isLinux() ? 'postgres' : null
  );

  const alterPasswdQuery = `"ALTER USER ${envVars.PGUSER} WITH PASSWORD '${envVars.PGPASSWORD}';"`;

  await execCmd(
    DB_PG_PATH + 'psql',
    ['-c', alterPasswdQuery, '-d', envVars.PGDATABASE],
    `Couldn't set the password for user ${envVars.PGUSER}.`,
    {
      ...getCwd(),
      env: envHostPort,
    },
    verbose,
    null,
    // run as the postgres user
    isLinux() ? 'postgres' : null
  );

  log('DB successfully initialized and running.');
}

function getCmd({ config, network }: TOptions): string {
  let cmd = './rise db init';
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
