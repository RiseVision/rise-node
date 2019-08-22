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
        'Error when importing the backup file.' +
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
