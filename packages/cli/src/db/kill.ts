// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import kill from 'tree-kill';
import { killProcessTree } from '../shared/kill';
import { closeLog, debug, log } from '../shared/log';
import { IVerbose, verboseOption } from '../shared/options';

export type TOptions = IVerbose;

export default leaf({
  commandName: 'kill',
  description: 'Forcefully kills all the PostgreSQL processes',

  options: {
    ...verboseOption,
  },

  async action({ verbose }: TOptions) {
    try {
      await dbKill();
    } catch (err) {
      if (verbose) {
        log(err);
      }
      log(
        '\nError while killing postgres.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function dbKill() {
  debug('nodeKill');
  await killProcessTree('postgres');
}
