// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { dbAddRepo } from '../db/install';
import { closeLog, debug, log } from '../shared/log';
import { checkSudo, execCmd } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export type TOptions = IVerbose;

export default leaf({
  commandName: 'install-deps',
  description: 'Install required dependencies to run a node on Ubuntu',
  options: verboseOption,

  async action({ verbose }: TOptions) {
    try {
      await nodeInstallDeps({ verbose });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nError while rebuilding native node modules.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function nodeInstallDeps({ verbose }: TOptions, addDBRepo = true) {
  checkSudo();

  if (addDBRepo) {
    dbAddRepo({ verbose });
  }
  execSync('apt-get update');
  const file = 'sudo';
  const params = [
    'apt-get',
    'install',
    '-y',
    // packages required to build native modules
    // keep in sync with Docker.node_modules
    'build-essential',
    'python',
    'postgresql-client-11',
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

  log("Installing native modules' dependencies");
  await execCmd(file, params, errorMsg, null, verbose);

  log('RISE Node dependencies have been installed.');
}
