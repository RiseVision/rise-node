// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import delay from 'delay';
import extend from 'extend';
import fs from 'fs';
import { download } from './download';
import { sql } from './migrate/migrate-v1-v2';
import { nodeStart } from './node/start';
import { MIN, SEC } from './shared/constants';
import { checkSourceDir } from './shared/fs-ops';
import {
  execCmd,
  getBlockHeight,
  getDBEnvVars,
  hasLocalPostgres,
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
      try {
        await checkSourceDir();
      } catch {
        await download();
      }

      if (!hasLocalPostgres()) {
        console.log('Install PostgreSQL first:');
        console.log('$ sudo ./rise db install');
        return;
      }

      // make sure the v1 node is running
      await execCmd(
        './manager.sh',
        ['start', 'node'],
        "Couldn't start the v1 node",
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

      console.log('Getting the current block height...');

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
        verbose
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
        "If you want to go back to v1, run './manager.sh restoreBackup'"
      );

      let tries = 0;
      while (++tries <= 3) {
        console.log('Starting the v2 node');
        if (tries > 1) {
          console.log(`Try ${tries}`);
        }
        try {
          await nodeStart({ config, network, verbose, v1: true });
        } catch (e) {
          console.log('v2 node couldnt start, waiting for 3mins...');
          await delay(3 * MIN);
        }
      }

      console.log('DONE');
      console.log('To verify:\n$ ./rise node status');
      if (network === 'mainnet') {
        console.log('To start:\n$ ./rise node start --v1');
      } else {
        console.log(`To start:\n$ ./rise node start --v1 --network ${network}`);
      }
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
