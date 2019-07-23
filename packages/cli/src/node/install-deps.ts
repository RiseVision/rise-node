// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execCmd } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export default leaf({
  commandName: 'install-deps',
  description: 'Install required dependencies to run a node on Ubuntu',
  options: verboseOption,

  async action({ verbose }: IVerbose) {
    try {
      const file = 'apt-get';
      const params = [
        'install',
        '-y',
        'build-essential',
        'python',
        'postgresql-server-dev-all',
      ];
      const errorMsg =
        "Couldn't install required dependencies.\n\n" +
        "Make sure you're using `sudo`:\n" +
        '$ sudo ./rise node install-deps\n' +
        '\n' +
        'Alternatively run the following command manually:\n' +
        `$ sudo ${file} ${params.join(' ')}`;

      await execCmd(file, params, errorMsg, null, verbose);

      console.log('RISE node dependencies have been installed.');
    } catch {
      console.log(
        '\nError while rebuilding native node modules. ' +
          'Examine the log using --verbose.'
      );
      process.exit(1);
    }
  },
});
