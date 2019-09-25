// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import fs from 'fs';
import { getConfigPath } from './shared/fs-ops';
import { log } from './shared/misc';
import {
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from './shared/options';

export type TOptions = INetwork & IVerbose;

export default leaf({
  commandName: 'config-defaults',
  description:
    'Prints a default config for a specific network. Useful for creating custom configs.',

  options: {
    ...networkOption,
    ...verboseOption,
  },

  async action({ network, verbose }: TOptions) {
    try {
      process.stdout.write(
        fs.readFileSync(getConfigPath(network), {
          encoding: 'utf8',
        })
      );
    } catch (err) {
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nSomething went wrong. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});
