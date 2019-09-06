// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execCmd, log } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export default leaf({
  commandName: 'install-deps',
  description: 'Install required dependencies to run a node on Ubuntu',
  options: verboseOption,

  async action({ verbose }: IVerbose) {
    try {
      await nodeInstallDeps({ verbose });
    } catch (err) {
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nError while rebuilding native node modules.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function nodeInstallDeps({ verbose }: IVerbose) {
  const file = 'apt-get';
  const params = [
    'install',
    '-y',
    // packages required to build native modules
    // keep in sync with Docker.node_modules
    'build-essential',
    'python',
    'postgresql-server-dev-all',
    'libtool',
    'autoconf',
  ];
  const errorMsg =
    "Couldn't install required dependencies.\n\n" +
    "Make sure you're using `sudo`:\n" +
    '$ sudo ./rise node install-deps\n' +
    '\n' +
    'Alternatively run the following command manually:\n' +
    `$ sudo ${file} ${params.join(' ')}`;

  console.log("Installing native modules' dependencies");
  await execCmd(file, params, errorMsg, null, verbose);

  console.log('RISE node dependencies have been installed.');
}
