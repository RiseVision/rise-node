// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { checkNodeDirExists, execCmd, extractSourceFile } from '../shared/misc';
import { IShowLogs, showLogsOption } from '../shared/options';

export default leaf({
  commandName: 'install-deps',
  description: 'Install required dependencies to run a node on Ubuntu',
  options: showLogsOption,

  async action({ show_logs }: IShowLogs) {
    if (!checkNodeDirExists(true)) {
      await extractSourceFile();
    }

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
        'Alternatively run the following command manually:\n' +
        `$ sudo ${file} ${params.join(' ')}`;

      await execCmd(file, params, errorMsg, null, show_logs);

      console.log('RISE node dependencies have been installed.');
    } catch {
      console.log(
        '\nError while rebuilding native node modules. ' +
          'Examine the log using --show_logs.'
      );
      process.exit(1);
    }
  },
});
