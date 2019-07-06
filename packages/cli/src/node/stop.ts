// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { getPID, LOCK_FILE } from '../misc';

export default leaf({
  commandName: 'stop',
  description: 'Stops the node using the PID file',

  async action() {
    const pid = getPID();
    if (!pid) {
      console.log(`ERROR: Lock file doesn't exist.\n${LOCK_FILE}`);
      return;
    }
    console.log(`Killing RISE node with PID ${pid}`);

    process.kill(parseInt(pid, 10));
  },
});
