// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { getNodePID, NODE_LOCK_FILE } from '../shared/misc';

export default leaf({
  commandName: 'stop',
  description: 'Stops the node using the PID file',

  async action() {
    const pid = getNodePID();
    if (!pid) {
      console.log(`ERROR: Lock file doesn't exist.\n${NODE_LOCK_FILE}`);
      return;
    }
    console.log(`Killing RISE node with PID ${pid}`);

    process.kill(pid);
  },
});
