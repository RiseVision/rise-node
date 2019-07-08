// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import * as fs from 'fs';
import { getConfigPath } from './shared/misc';
import { INetwork, networkOption } from './shared/options';

export default leaf({
  commandName: 'config-defaults',
  description:
    'Prints config default for a specific network. Useful when creating custom configs.',

  options: {
    ...networkOption,
  },

  action({ network }: INetwork) {
    process.stdout.write(
      fs.readFileSync(getConfigPath(network), {
        encoding: 'utf8',
      })
    );
  },
});
