// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import confirm from '@inquirer/confirm';
import { ConditionsNotMetError, handleCLIError } from '../shared/exceptions';
import { closeLog, debug, log } from '../shared/log';
import { assertV1Dir, execCmd } from '../shared/misc';
import { IV1, IVerbose, v1Option, verboseOption } from '../shared/options';

export type TOptions = IVerbose & IV1;

export default leaf({
  commandName: 'reset',
  description: 'Resets the node by removing all the data',

  options: {
    ...verboseOption,
    ...v1Option,
  },

  async action({ verbose, v1 }: TOptions) {
    try {
      await nodeReset({ verbose, v1 });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function nodeReset({ verbose, v1 }: TOptions) {
  try {
    if (!v1) {
      throw new ConditionsNotMetError(
        'Currently `node reset` works only with the --v1 param'
      );
    }
    assertV1Dir();
    const reset = await confirm({
      message: 'This will remove all the data. Are you sure?',
    });
    if (reset) {
      await execCmd(
        'rm',
        ['-R', 'data/pg'],
        "Couldn't remove the v1 data dir",
        null,
        verbose
      );
    }
  } catch (err) {
    handleCLIError(err);
  }
}
