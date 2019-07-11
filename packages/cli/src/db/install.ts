// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execCmd } from '../shared/misc';

export default leaf({
  commandName: 'install',
  description: 'Install PostgreSQL database on Ubuntu',

  async action() {
    try {
      execCmd(
        'apt-get install postgresql postgresql-contrib',
        "Couldn't install PostgreSQL"
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
