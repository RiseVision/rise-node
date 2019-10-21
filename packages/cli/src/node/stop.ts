// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import kill from 'tree-kill';
import { promisify } from 'util';
import { getNodePID, removeNodeLock } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import { execCmd } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

const killAsync = promisify(kill);

export type TOptions = IVerbose & { v1?: boolean };

export default leaf({
  commandName: 'stop',
  description: 'Stops the node using the PID file',

  options: {
    ...verboseOption,
    v1: {
      defaultValue: false,
      description: 'Stop also the v1 DB',
      nullable: true,
      typeName: 'boolean',
    },
  },

  async action({ verbose, v1 }: TOptions) {
    try {
      await nodeStop({ verbose, v1 });
    } catch (err) {
      if (verbose) {
        log(err);
      }
      log(
        '\nError while stopping the node.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function nodeStop({ verbose, v1 }: TOptions = {}) {
  debug('nodeStop');
  const pid = getNodePID();
  if (!pid) {
    log("RISE Node isn't running");
    return;
  }
  debug(`Killing PID tree ${pid}`);
  log(`Killing RISE Node with PID ${pid}`);

  if (v1) {
    // TODO check if in the v1 dir when --v1
    // TODO extract along with start.ts
    log('Stopping the v1 DB');
    await execCmd(
      './manager.sh',
      ['stop', 'db'],
      "Couldn't stop the v1 DB",
      null,
      verbose,
      null
    );
  }

  await killAsync(pid);
  removeNodeLock();
}
