// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execCmd } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export default leaf({
  commandName: 'install',
  description: 'Install PostgreSQL database on Ubuntu',
  options: verboseOption,

  async action({ verbose }: IVerbose) {
    try {
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
    } catch {
      process.exit(1);
    }
  },
});
