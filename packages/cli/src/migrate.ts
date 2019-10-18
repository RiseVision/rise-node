// tslint:disable:no-console
/**
 * TODO
 * - turn off user nodes X time before the core ones
 * - migrate core nodes 1-by-1
 * - keep trying to connect to core nodes from user nodes in a loop
 * - failsafe `download-snapshot` after a long time on user nodes
 */
import { leaf, option } from '@carnesen/cli';
import clone from 'clone-deep';
import delay from 'delay';
import extend from 'extend';
import fs from 'fs';
import { download } from './download';
import { sql } from './migrate/migrate-v1-v2';
import { nodeCrontab } from './node/crontab';
import { nodeStart } from './node/start';
import { MIN, SEC } from './shared/constants';
import { checkSourceDir } from './shared/fs-ops';
import { debug, log } from './shared/log';
import {
  execCmd,
  getBlockHeight,
  getDBEnvVars,
  hasLocalPostgres,
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

// extend the existing `config` option, but deep clone it, to avoid overriding
const v1ConfigOption = extend(true, clone(configOption), {
  config: {
    defaultValue: 'etc/node_config.json',
  },
});

export default leaf({
  commandName: 'migrate',
  description:
    'Migrates from v1 to v2 at a specific block height. ' +
    'Requires a running v1 RISE Node.',

  options: {
    ...v1ConfigOption,
    ...networkOption,
    blockHeight: option({
      // TODO take from /packages/rise/etc/[testnet|mainnet]/constants.js ???
      defaultValue: 2432687,
      description: 'Migration block (0 = next one)',
      nullable: false,
      typeName: 'number',
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
        log('Dependencies not installed:');
        log('$ sudo ./rise node install-deps');
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

      // precheck end

      debug(getDBEnvVars(network, config));

      log('Getting the current block height...');

      let blockHeightNow = await getBlockHeight(network, config);

      log(`Block height = ${blockHeightNow}`);

      if (!blockHeight) {
        blockHeight = blockHeightNow + 1;
        debug(`Automatic block height ${blockHeight}`);
      }
      if (blockHeightNow > blockHeight) {
        log('Migration block is lower then the current one');
        throw new Error('migration block too low');
      }

      log(
        `Waiting for block ${blockHeight} (${blockHeight -
          blockHeightNow} blocks from now)`
      );

      while (true) {
        blockHeightNow = await getBlockHeight(network, config);
        if (blockHeightNow >= blockHeight) {
          log('Migration block reached, starting the process...');
          debug(`found the migration block ${blockHeight}`);
          break;
        }
        // TODO align with the time blocks get mined
        await delay(10 * SEC);
      }

      // MIGRATE

      log('Backing up the DB');

      // backup the DB
      await execCmd(
        './manager.sh',
        ['backup'],
        "Couldn't start the DB",
        null,
        verbose
      );

      log('Stopping the V1 node');

      // stop the v1 node
      await execCmd(
        './manager.sh',
        ['stop', 'node'],
        "Couldn't stop the v1 node",
        null,
        verbose,
        30 * SEC
      );

      log('Migrating...');

      await runSQL(sql, network, config, verbose);

      log('DB migration successful');
      log("If you want to go back to v1, run './manager.sh restoreBackup'");

      // handle crontab
      await nodeCrontab({ verbose, v1: true });

      let tries = 0;
      while (++tries <= 3) {
        log('Starting the v2 node');
        if (tries > 1) {
          log(`Try ${tries}`);
        }
        try {
          await nodeStart({
            config,
            crontab: true,
            network,
            v1: true,
            verbose,
          });
          break;
        } catch (e) {
          log('v2 node couldnt start, waiting for 3mins...');
          await delay(3 * MIN);
        }
      }

      log('DONE');
      log('To verify:\n$ ./rise node status --v1');
      if (network === 'mainnet') {
        log('To start:\n$ ./rise node start --v1 --crontab');
      } else {
        log(
          `To start:\n$ ./rise node start --v1 --crontab --network ${network}`
        );
      }
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});
