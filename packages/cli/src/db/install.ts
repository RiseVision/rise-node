// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execCmd } from '../shared/misc';
import { IShowLogs, showLogsOption } from '../shared/options';

export default leaf({
  commandName: 'install',
  description: 'Install PostgreSQL database on Ubuntu',
  options: showLogsOption,

  async action({ show_logs }: IShowLogs) {
    try {
      const file = 'apt-get';
      const params = ['install', ' -y', 'postgresql', 'postgresql-contrib'];
      const errorMsg =
        "Couldn't install PostgreSQL" +
        "Make sure you're using `sudo`:\n" +
        '$ sudo ./rise db install\n' +
        'Alternatively run the following command manually:\n' +
        `$ sudo ${file} ${params.join(' ')}`;

      await execCmd(file, params, errorMsg, null, show_logs);
    } catch {
      console.log(
        '\nError while installing PostgreSQL.\n' +
          'Make sure you run the command with "sudo".\n' +
          '$ sudo ./rise db install'
      );
      process.exit(1);
    }
  },
});
