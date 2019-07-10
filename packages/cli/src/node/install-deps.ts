// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import {
  checkNodeDirExists,
  cmdSilenceString,
  execCmd,
  extractSourceFile,
} from '../shared/misc';
import { IShowLogs, showLogsOption } from '../shared/options';

export default leaf({
  commandName: 'install-deps',
  description: 'Install required dependencies to run a node on Ubuntu',
  options: showLogsOption,

  async action({ show_logs }: IShowLogs) {
    if (!checkNodeDirExists(true)) {
      extractSourceFile();
    }

    const silent = show_logs ? '' : cmdSilenceString;

    try {
      execCmd(
        'apt-get install -y build-essential python ' +
          `postgresql-server-dev-all ${silent}`,
        "Couldn't install required dependencies.\n\n" +
          "Make sure you're using `sudo`" +
          '$ sudo ./rise node install-deps'
      );

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
