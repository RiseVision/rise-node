// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execCmd, log } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export default leaf({
  commandName: 'install',
  description: 'Install PostgreSQL database on Ubuntu',
  options: verboseOption,

  async action({ verbose }: IVerbose) {
    try {
      await dbInstall({ verbose });
    } catch (err) {
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        'Error when installing the DB. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function dbInstall({ verbose }: IVerbose) {
  console.log('Installing the default version of PostgreSQL...');
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
  console.log('PostgreSQL installed.');
}

// TODO automate all 3 cmds
// export async function dbInstall({ verbose }: IVerbose) {
//   // get the default postgres to get the repo script
//   console.log('Installing the default PostgreSQL');
//   await dbCmd(
//     'apt',
//     ['install', '-y', 'postgresql', 'postgresql-contrib'],
//     verbose
//   );
//
//   // add postgres 11 repo
//   // TODO requires pressing enter
//   console.log('Adding PostgreSQL 11 repository');
//   await dbCmd(
//     'sh',
//     ['/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh'],
//     verbose
//   );
//
//   // install postgres 11
//   console.log('Installing PostgreSQL v11');
//   await dbCmd('apt', ['install', 'postgresql-11'], verbose);
//
//   console.log('PostgreSQL installed.');
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
