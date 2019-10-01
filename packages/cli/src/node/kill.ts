// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import kill from 'tree-kill';
import { promisify } from 'util';
import { closeLog, debug, log } from '../shared/log';
import { execCmd } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

const killAsync = promisify(kill);

export type TOptions = IVerbose;

export default leaf({
  commandName: 'kill',
  description: 'Forcefully kills all the RISE Node processes',

  options: {
    ...verboseOption,
  },

  async action({ verbose }: TOptions) {
    try {
      await nodeKill();
    } catch (err) {
      if (verbose) {
        log(err);
      }
      log(
        '\nError while killing the node.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function nodeKill() {
  debug('nodeKill');
  const list = await execCmd('ps x', null, "Couldn't get the process IDs");

  const match = 'rise-launchpad';
  const regex = new RegExp(`^\s*(\d+).+${match}`, 'mg');

  const pids = list.match(regex);
  if (!pids.length) {
    log("RISE Node isn't running");
    return;
  }

  // TODO parallel
  for (const pid of pids) {
    debug(`Killing PID tree ${pid}`);
    log(`Killing RISE Node with PID ${pid}`);
    await killAsync(parseInt(pid, 10));
  }
}
