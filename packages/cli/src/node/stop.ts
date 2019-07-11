// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { getNodePID, log } from '../shared/misc';

export default leaf({
  commandName: 'stop',
  description: 'Stops the node using the PID file',

  action() {
    try {
      nodeStop();
    } catch {
      console.log(
        '\nError while stopping the node. Examine the log using --show_logs.'
      );
      process.exit(1);
    }
  },
});

export function nodeStop(showErrors = true) {
  log('nodeStop');
  const pid = getNodePID();
  if (!pid) {
    if (showErrors) {
      console.log('ERROR: No node running...');
    }
    return;
  }
  console.log(`Killing RISE node with PID ${pid}`);

  process.kill(pid);
}
