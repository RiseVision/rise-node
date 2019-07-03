// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import * as fs from 'fs';
import { PID_FILE } from '../misc';

export default leaf({
  commandName: 'stop',
  description: 'Stops the node using the PID file',

  async action() {
    if (!fs.existsSync(PID_FILE)) {
      console.log(`ERROR: PID file doesn't exist.\n${PID_FILE}`);
      return;
    }
    const pid = fs.readFileSync(PID_FILE, { encoding: 'utf8' });
    console.log(`Killing RISE node with PID ${pid}`);

    process.kill(parseInt(pid, 10));
  },
});
