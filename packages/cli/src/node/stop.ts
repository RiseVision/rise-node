// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { getNodePID, NODE_LOCK_FILE } from '../shared/misc';

export default leaf({
  commandName: 'stop',
  description: 'Stops the node using the PID file',

  async action() {
    const pid = getNodePID();
    if (!pid) {
      console.log('ERROR: No node running...');
      return;
    }
    console.log(`Killing RISE node with PID ${pid}`);

    process.kill(pid);
  },
});
