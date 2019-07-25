// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import kill from 'tree-kill';
import { promisify } from 'util';
import { getNodePID, log } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

const killAsync = promisify(kill);

export type TOptions = IVerbose;

export default leaf({
  commandName: 'stop',
  description: 'Stops the node using the PID file',

  options: {
    ...verboseOption,
  },

  async action({ verbose }: TOptions) {
    try {
      await nodeStop({ verbose });
    } catch (err) {
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nError while stopping the node.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function nodeStop({ verbose }: TOptions) {
  log('nodeStop');
  const pid = getNodePID();
  if (!pid) {
    if (verbose) {
      console.log("RISE node isn't running");
    }
    return;
  }
  console.log(`Killing RISE node with PID ${pid}`);

  await killAsync(pid);
}
