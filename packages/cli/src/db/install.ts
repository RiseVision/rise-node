// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { closeLog, debug, log } from '../shared/log';
import { execCmd } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export default leaf({
  commandName: 'install',
  description: 'Install PostgreSQL database on Ubuntu',
  options: verboseOption,

  async action({ verbose }: IVerbose) {
    try {
      await dbInstall({ verbose });
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

export async function dbInstall({ verbose }: IVerbose) {
  log('Installing the default version of PostgreSQL...');
  const file = 'apt-get';
  const params = ['install', '-y', 'postgresql', 'postgresql-contrib'];
  const errorMsg =
    "Couldn't install PostgreSQL.\n\n" +
    "Make sure you're using `sudo`:\n" +
    '$ sudo ./rise db install\n' +
    '\n' +
    'Alternatively run the following command manually:\n' +
    `$ sudo ${file} ${params.join(' ')}`;

  await execCmd(file, params, errorMsg, null, verbose);
  log('PostgreSQL installed.');
}

// TODO automate all 3 cmds
// export async function dbInstall({ verbose }: IVerbose) {
//   // get the default postgres to get the repo script
//   log('Installing the default PostgreSQL');
//   await dbCmd(
//     'apt',
//     ['install', '-y', 'postgresql', 'postgresql-contrib'],
//     verbose
//   );
//
//   // add postgres 11 repo
//   // TODO requires pressing enter
//   log('Adding PostgreSQL 11 repository');
//   await dbCmd(
//     'sh',
//     ['/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh'],
//     verbose
//   );
//
//   // install postgres 11
//   log('Installing PostgreSQL v11');
//   await dbCmd('apt', ['install', 'postgresql-11'], verbose);
//
//   log('PostgreSQL installed.');
// }
//
// async function dbCmd(file: string, params: string[], verbose = false) {
//   const errorMsg =
//     "Couldn't install PostgreSQL.\n\n" +
//     "Make sure you're using `sudo`:\n" +
//     '$ sudo ./rise db install\n' +
//     '\n' +
//     'Alternatively run the following command manually:\n' +
//     `$ sudo ${file} ${params.join(' ')}`;
//
//   await execCmd(file, params, errorMsg, null, verbose);
// }
