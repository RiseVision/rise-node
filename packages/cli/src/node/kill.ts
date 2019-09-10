// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import kill from 'tree-kill';
import { promisify } from 'util';
import { execCmd, log } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

const killAsync = promisify(kill);

export type TOptions = IVerbose;

export default leaf({
  commandName: 'kill',
  description: 'Forcefully kills all the RISE node processes',

  options: {
    ...verboseOption,
  },

  async action({ verbose }: TOptions) {
    try {
      await nodeKill();
    } catch (err) {
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nError while killing the node.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function nodeKill() {
  log('nodeKill');
  const cmdOut = await execCmd(
    'pgrep',
    // TODO greps too much, use `ps`
    ['"rise-launchpad"', '-f'],
    "Couldn't get the process IDs"
  );

  const pids = cmdOut.trim().split('\n');
  if (!pids.length) {
    console.log("RISE node isn't running");
    return;
  }

  for (const pid of pids) {
    log(`Killing PID tree ${pid}`);
    console.log(`Killing RISE node with PID ${pid}`);
    await killAsync(parseInt(pid, 10));
  }
}
