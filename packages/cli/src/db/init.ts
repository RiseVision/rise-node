// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import delay from 'delay';
import path from 'path';
import { nodeStop } from '../node/stop';
import { DB_DATA_DIR, DB_LOG_FILE, DB_PG_CTL, SEC } from '../shared/constants';
import { NoRiseDistFileError } from '../shared/exceptions';
import {
  checkSourceDir,
  execCmd,
  getDBEnvVars,
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
      log(err);
      if (verbose) {
        console.log(err);
      }
      if (!(err instanceof NoRiseDistFileError)) {
        let cmd = path.resolve(__dirname, 'rise') + ' db init';
        if (config) {
          cmd += ` --config=${config}`;
        }
        if (network !== 'mainnet') {
          cmd += ` --network=${network}`;
        }

        console.log(
          '\nError while initializing a PostgreSQL database.\n' +
            getLinuxHelpMsg(config, network) +
            `\nExamine the log using --verbose and check ${DB_LOG_FILE}.`
        );
      }
      process.exit(1);
    }
  },
});

export async function dbInit({ config, network, verbose }: TOptions) {
  await checkSourceDir(true);
  if (verbose) {
    printUsingConfig(network, config);
  }

  const envVars = getDBEnvVars(network, config, true);
  const env = { ...process.env, ...envVars };
  const envHostPort = {
    ...process.env,
    PGHOST: envVars.PGHOST,
    PGPORT: envVars.PGPORT,
  };

  // stop the node and DB
  await nodeStop({ verbose });
  await dbStop({ config, network, verbose });

  log(envVars);

  await execCmd(
    'rm',
    ['-Rf', DB_DATA_DIR],
    `Couldn't remove the data dir ${DB_DATA_DIR}.`,
    { env },
    verbose
  );

  await execCmd(
    DB_PG_CTL,
    ['init', '-D', DB_DATA_DIR],
    `Couldn't init a new DB data dir in ${DB_DATA_DIR}.`,
    { env },
    verbose
  );

  await delay(2 * SEC);

  // start the DB
  await dbStart({ config, network, verbose });
  // wait just in case
  await delay(3 * SEC);

  // optionally add the user
  try {
    await execCmd(
      'createuser',
      ['--superuser', envVars.PGUSER],
      `Couldn't create a new user ${envVars.PGUSER}.`,
      {
        env: envHostPort,
      },
      verbose
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
    'createdb',
    [envVars.PGDATABASE],
    `Couldn't create a new database ${envVars.PGDATABASE}.`,
    {
      env: envHostPort,
    },
    verbose
  );

  const alterPasswdQuery = `"ALTER USER ${envVars.PGUSER} WITH PASSWORD '${
    envVars.PGPASSWORD
  }';"`;

  await execCmd(
    'psql',
    ['-c', alterPasswdQuery, '-d', envVars.PGDATABASE],
    `Couldn't set the password for user ${envVars.PGUSER}.`,
    {
      env: envHostPort,
    },
    verbose
  );

  console.log('DB successfully initialized and running.');
}

function getLinuxHelpMsg(config, network) {
  if (process.platform !== 'linux') {
    return '';
  }
  let cmd = '$ ' + path.resolve(__dirname, 'rise') + ' db init';
  if (config) {
    cmd += ` --config ${path.resolve(__dirname, config)}`;
  }
  if (network !== 'mainnet') {
    cmd += ` --network ${network}`;
  }
  return (
    '\nRun the following commands:\n' + '$ sudo su - postgres\n' + cmd + '\n'
  );
}
