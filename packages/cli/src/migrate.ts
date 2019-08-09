// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { log } from './shared/misc';
import {
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from './shared/options';

export type TOptions = INetwork & IVerbose;

export default leaf({
  commandName: 'migrate',
  description:
    'Migrates from v1 to v2 at a specific block height. ' +
    'Requires a running v1 RISE node.',

  options: {
    ...networkOption,
    ...verboseOption,
  },

  async action({ verbose }: TOptions) {
    try {
      // TODO
      //  check if ran in the v1 dir
      //  get v2 dir from __dirname or --v2-dir param
      //  read the v1 config and get the DB info
      //  test the v1 DB and get the block height
      //  detect if ran in screen?
      //  test if v2 starts properly (create a config)
      //  - download the release if necessary
      //  start watching the block height in a loop
      //  migrate:
      //  - kill the v1
      //  - backup the v2 DB (!!!)
      //  - migrate the SQL
      //  - start the v2
      //  - verify the block height from v2
      // TODO
      //  --db-only param to test the DB migration
      //  DB
      //  - keep using the v1 DB by default (instructions)
      //  - export/import to v2 with --use-v2-db (verify if running)
      //    - having a DB service using pg cluster before would be great
    } catch (err) {
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nSomething went wrong.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});
