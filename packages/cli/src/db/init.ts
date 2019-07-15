// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import delay from 'delay';
import * as path from 'path';
import { nodeStop } from '../node/stop';
import {
  checkNodeDirExists,
  cmdSilenceString,
  DB_DATA_DIR,
  DB_LOG_FILE,
  DB_PG_CTL,
  execCmd,
  extractSourceFile,
  getDBEnvVars,
  log,
  printUsingConfig,
  SEC,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IShowLogs,
  networkOption,
  showLogsOption,
} from '../shared/options';
import { dbStart } from './start';
import { dbStop } from './stop';

export type TOptions = INetwork & IConfig & IShowLogs;

export default leaf({
  commandName: 'init',
  description: 'Initialize a fresh DB and start it',
  options: {
    ...configOption,
    ...showLogsOption,
    ...networkOption,
  },

  async action({ config, network, show_logs }: TOptions) {
    try {
      if (!checkNodeDirExists(false, true)) {
        extractSourceFile(true);
      }
      printUsingConfig(network, config);

      const silent = show_logs ? '' : cmdSilenceString;
      const envVars = getDBEnvVars(network, config, true);

      // stop the node and DB
      nodeStop(false);
      await dbStop({ config, network, show_logs });

      log(envVars);

      execCmd(
        `rm -Rf ${DB_DATA_DIR} ${silent}`,
        `Couldn't remove the data dir ${DB_DATA_DIR}.`,
        envVars
      );

      execCmd(
        `${DB_PG_CTL} init -D ${DB_DATA_DIR} ${silent}`,
        `Couldn't init a new DB data dir in ${DB_DATA_DIR}.`,
        envVars
      );

      await delay(2 * SEC);

      // start the DB
      await dbStart({ config, network, show_logs });
      // wait just in case
      await delay(3 * SEC);

      // optionally add the user
      try {
        execCmd(
          `createuser --superuser ${envVars.PGUSER}`,
          `Couldn't create a new user ${envVars.PGUSER}.`,
          {
            PGHOST: envVars.PGHOST,
            PGPORT: envVars.PGPORT,
          }
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

      execCmd(
        `createdb ${envVars.PGDATABASE}`,
        `Couldn't create a new database ${envVars.PGDATABASE}.`,
        {
          PGHOST: envVars.PGHOST,
          PGPORT: envVars.PGPORT,
        }
      );

      execCmd(
        `psql -c "ALTER USER ${envVars.PGUSER} WITH PASSWORD '${
          envVars.PGPASSWORD
        }';" -d ${envVars.PGDATABASE}`,
        `Couldn't set the password for user ${envVars.PGUSER}.`,
        {
          PGHOST: envVars.PGHOST,
          PGPORT: envVars.PGPORT,
        }
      );

      console.log('DB succesfully initialized and running.');
    } catch {
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
          `Examine the log using --show_logs and check ${DB_LOG_FILE}.`
      );
      process.exit(1);
    }
  },
});

function getLinuxHelpMsg(config, network) {
  if (process.platform !== 'linux') {
    return '';
  }
  let cmd = path.resolve(__dirname, 'rise') + ' db init';
  if (config) {
    cmd += ` --config=${path.resolve(__dirname, config)}`;
  }
  if (network !== 'mainnet') {
    cmd += ` --network=${network}`;
  }
  return (
    'Make sure you\'re logged in as "postgres" user:\n' +
    '$ sudo su - postgres\n\n' +
    'Then run the following command:\n' +
    cmd +
    '\n'
  );
}
