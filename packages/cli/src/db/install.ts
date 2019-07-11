// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { cmdSilenceString, execCmd } from '../shared/misc';
import { IShowLogs, showLogsOption } from '../shared/options';

export default leaf({
  commandName: 'install',
  description: 'Install PostgreSQL database on Ubuntu',
  options: showLogsOption,

  async action({ show_logs }: IShowLogs) {
    const silent = show_logs ? '' : cmdSilenceString;

    try {
      const cmd = 'apt-get install postgresql postgresql-contrib';

      execCmd(
        cmd + ' ' + silent,
        "Couldn't install PostgreSQL" +
          "Make sure you're using `sudo`:\n" +
          '$ sudo ./rise db install\n' +
          'Alternatively run the following command manually:\n' +
          `$ sudo ${cmd}`
      );
    } catch {
      console.log(
        '\nError while installing PostgreSQL. Make sure you run the command with "sudo".\n' +
          '$ sudo ./rise db install'
      );
      process.exit(1);
    }
  },
});
