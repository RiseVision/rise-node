// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import delay from 'delay';
import extend from 'extend';
import fs from 'fs';
import { sql } from './migrate/migrate-v1-v2';
import { nodeStart } from './node/start';
import { MIN, SEC } from './shared/constants';
import { checkSourceDir } from './shared/fs-ops';
import {
  execCmd,
  getBlockHeight,
  getDBEnvVars,
  log,
  runSQL,
} from './shared/misc';
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
      // prechecks
      if (!fs.existsSync('etc')) {
        throw new Error('no in a v1 dir');
      }
      await checkSourceDir();
      // TODO copy the config ???
      // TODO use data/node_config if exists

      // make sure the v1 node is running
      await execCmd(
        './manager.sh',
        ['start', 'node'],
        "Couldn't start the V1 node",
        null,
        verbose,
        30 * SEC
      );

      // make sure the DB is running
      await execCmd(
        './manager.sh',
        ['start', 'db'],
        "Couldn't start the DB",
        null,
        verbose,
        30 * SEC
      );

      // TODO check if db-deps are installed

      // precheck end

      log(getDBEnvVars(network, config));

      let blockHeightNow = await getBlockHeight(network, config);
      if (!blockHeight) {
        blockHeight = blockHeightNow + 1;
        log(`Automatic block height ${blockHeight}`);
      }
      if (blockHeightNow >= blockHeight) {
        console.log('Migration block is lower then the current one');
        throw new Error('migration block too low');
      }

      console.log(
        `Waiting for block ${blockHeight} (${blockHeight -
          blockHeightNow} blocks from now)`
      );

      while (true) {
        blockHeightNow = await getBlockHeight(network, config);
        if (blockHeightNow >= blockHeight) {
          console.log('Migration block reached, starting the process...');
          log(`found the migration block ${blockHeight}`);
          break;
        }
        // TODO align with the time blocks get mined
        await delay(10 * SEC);
      }

      // MIGRATE

      console.log('Backing up the DB');

      // backup the DB
      await execCmd(
        './manager.sh',
        ['backup'],
        "Couldn't start the DB",
        null,
        verbose,
        3 * MIN
      );

      console.log('Stopping the V1 node');

      // stop the v1 node
      await execCmd(
        './manager.sh',
        ['stop', 'node'],
        "Couldn't stop the v1 node",
        null,
        verbose,
        30 * SEC
      );

      console.log('Migrating...');

      await runSQL(sql, network, config);

      console.log('DB migration successful');
      console.log(
        "If you want to go back to the v1, run './manager.sh restoreBackup'"
      );

      await nodeStart({ config, network, verbose, v1: true });

      console.log('done, call "$ ./rise node status" to verify');

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
        '\nSomething went wrong. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});
