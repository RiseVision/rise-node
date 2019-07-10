// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import delay from 'delay';
import { nodeStop } from '../node/stop';
import {
  checkNodeDirExists,
  cmdSilenceString,
  DB_DATA_DIR,
  DB_LOG_FILE,
  execCmd,
  extractSourceFile,
  getDBVars,
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
      if (!checkNodeDirExists(true)) {
        extractSourceFile();
      }
      printUsingConfig(network, config);

      const silent = show_logs ? '' : cmdSilenceString;
      const envVars = getDBVars(network, config);

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
        `pg_ctl init -D ${DB_DATA_DIR} ${silent}`,
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
        `psql -c "ALTER USER rise WITH PASSWORD '${envVars.PGPASSWORD}';" -d ${
          envVars.PGDATABASE
        }`,
        `Couldn't set the password for user ${envVars.PGUSER}.`,
        {
          PGHOST: envVars.PGHOST,
          PGPORT: envVars.PGPORT,
        }
      );

      console.log('DB succesfully initialized and running.');
    } catch {
      console.log(
        '\nError while initializing a PostgreSQL database.\n' +
          'Make sure you\'re the "postgres" user:\n' +
          '$ sudo su - postgres\n\n' +
          `Examine the log using --show_logs and check ${DB_LOG_FILE}.`
      );
      process.exit(1);
    }
  },
});
