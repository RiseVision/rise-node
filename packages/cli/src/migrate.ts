// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import delay from 'delay';
import extend from 'extend';
import fs from 'fs';
import treeKill from 'tree-kill';
import { sql } from './migrate/migrate-v1-v2';
import { nodeStart } from './node/start';
import { MIN } from './shared/constants';
import { checkSourceDir } from './shared/fs-ops';
import { getBlockHeight, log, runSQL } from './shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from './shared/options';

export type TOptions = INetwork & IVerbose & IConfig & { blockHeight: number };

const v1ConfigOption = extend(true, configOption, {
  config: {
    defaultValue: 'etc/node_config.json',
  },
});

export default leaf({
  commandName: 'migrate',
  description:
    'Migrates from v1 to v2 at a specific block height. ' +
    'Requires a running v1 RISE node.',

  options: {
    ...v1ConfigOption,
    ...networkOption,
    blockHeight: option({
      description: 'Migration block (0 = next one)',
      nullable: true,
      typeName: 'string',
    }),
    ...verboseOption,
  },

  async action({ network, verbose, blockHeight, config }: TOptions) {
    try {
      if (!fs.existsSync('etc')) {
        throw new Error('no in a v1 dir');
      }
      await checkSourceDir(true);
      // copy the config
      // fs.cp(config, path.resolve(config));
      // TODO check if v1 running
      //  - download the release if necessary
      let blockHeightNow = await getBlockHeight(network, config);
      if (blockHeightNow >= blockHeight) {
        throw new Error('migration block too low');
      }
      while (true) {
        blockHeightNow = await getBlockHeight(network, config);
        if (blockHeightNow >= blockHeight) {
          log(`found the migration block ${blockHeight}`);
          break;
        }
        await delay(5 * MIN);
      }

      // MIGRATE

      // TODO use `manager node status`?
      const v1PID = parseInt(
        fs.readFileSync('pid/node.pid', { encoding: 'utf8' }),
        10
      );
      await treeKill(v1PID);

      await runSQL(sql, network, config);

      await nodeStart({ config, network });

      console.log('done, call "$ rise node status" to verify');

      //  test the v1 DB and get the block height
      //  detect if ran in screen?
      //  test if v2 starts properly (create a config)
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
      //  - expose `rise node start --v1-db`
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
