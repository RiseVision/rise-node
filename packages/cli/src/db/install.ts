// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { ConditionsNotMetError, handleCLIError } from '../shared/exceptions';
import { closeLog, debug, log } from '../shared/log';
import { isLinux, isSudo } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export type TOptions = { skipRepo?: boolean } & IVerbose;

export default leaf({
  commandName: 'install',
  description: 'Install PostgreSQL database on Ubuntu',
  options: verboseOption,

  async action({ verbose, skipRepo }: TOptions) {
    try {
      await dbInstall({ verbose, skipRepo });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        'Error when installing the DB. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function dbInstall({ verbose, skipRepo }: TOptions) {
  try {
    if (!isLinux()) {
      throw new ConditionsNotMetError('This command is linux-only');
    }
    if (!isSudo()) {
      throw new ConditionsNotMetError(
        'Run this command with sudo:\n$ sudo ./rise db install'
      );
    }
    log('Installing PostgreSQL...');
    // await execCmd('apt-get', ['update'], "Couldn't update APT", null, verbose);
    // const file = 'apt-get';
    // const params = ['install', '-y', 'postgresql', 'postgresql-contrib'];
    // const errorMsg =
    //   "Couldn't install PostgreSQL.\n\n" +
    //   "Make sure you're using `sudo`:\n" +
    //   '$ sudo ./rise db install\n' +
    //   '\n' +
    //   'Alternatively run the following command manually:\n' +
    //   `$ sudo ${file} ${params.join(' ')}`;
    //
    // await execCmd(file, params, errorMsg, null, verbose);

    // stop a running DB
    try {
      execSync('./rise db stop');
    } catch {
      // empty
    }

    if (!skipRepo) {
      dbAddRepos({ verbose });
    }

    // install postgres 11
    execSync('apt-get update');
    execSync('apt-get install postgresql-11 postgresql-client-11 -qq');

    // disable the postgres service
    execSync('service postgresql stop');
    execSync('systemctl disable postgresql');

    log('PostgreSQL installed.');
  } catch (err) {
    handleCLIError(err);
  }
}

export function dbAddRepos({ verbose }) {
  // install keys and repos
  const version = execSync('lsb_release -cs')
    .toString('utf8')
    .trim();
  execSync('apt --purge remove postgresql postgresql-10 -y -qq');
  execSync('apt install wget ca-certificates -qq');
  execSync(
    'wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -'
  );
  execSync(
    `add-apt-repository "deb http://apt.postgresql.org/pub/repos/apt/ ${version}-pgdg main"`
  );
}
