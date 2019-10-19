// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import kill from 'tree-kill';
import { killProcessTree } from '../shared/kill';
import { closeLog, debug, log } from '../shared/log';
import { IVerbose, verboseOption } from '../shared/options';

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
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function nodeKill() {
  debug('nodeKill');
  await killProcessTree('rise-launchpad');
}
