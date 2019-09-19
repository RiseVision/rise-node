// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import kill from 'tree-kill';
import { promisify } from 'util';
import { getNodePID } from '../shared/fs-ops';
import { execCmd, log } from '../shared/misc';
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

export async function nodeStop({ verbose, v1 }: TOptions = {}) {
  log('nodeStop');
  const pid = getNodePID();
  if (!pid) {
    console.log("RISE node isn't running");
    return;
  }
  log(`Killing PID tree ${pid}`);
  console.log(`Killing RISE node with PID ${pid}`);

  if (v1) {
    // TODO check if in the v1 dir when --v1
    // TODO extract along with start.ts
    console.log('Stopping the v1 DB');
    await execCmd(
      './manager.sh',
      ['stop', 'db'],
      "Couldn't stop the v1 DB",
      null,
      verbose
    );
  }

  await killAsync(pid);
}
