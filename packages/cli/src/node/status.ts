// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import fs from 'fs';
import { ConditionsNotMetError } from '../shared/exceptions';
import { checkSourceDir, getNodePID, getNodeState } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import { getBlockHeight, printUsingConfig } from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';

export type TOptions = IConfig & INetwork & IVerbose;

export default leaf({
  commandName: 'status',
  description: 'Show the status of a running RISE Node',

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
  },

  async action(options: TOptions) {
    try {
      await nodeStatus(options);
    } catch (err) {
      debug(err);
      if (options.verbose) {
        log(err);
      }
      log(
        'Something went wrong.' +
          (options.verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

/**
 * Starts a node or throws an exception.
 */
export async function nodeStatus({ config, network, verbose }: TOptions) {
  await checkConditions(config);

  if (verbose) {
    printUsingConfig(network, config);
  }

  // check the PID, but not when in DEV
  const pid = getNodePID();
  if (!pid) {
    log("RISE Node isn't running");
    return;
  }

  const state = getNodeState();

  log(`PID: ${pid}`);
  log(`State: ${state}`);

  debug('Getting block height from the DB...');

  const blockHeight = await getBlockHeight(network, config, verbose);
  if (!blockHeight) {
    throw new Error("ERROR: Couldn't get the block height");
  }

  log(`Block height: ${blockHeight}`);
}

async function checkConditions(config: string) {
  await checkSourceDir();
  if (config && !fs.existsSync(config)) {
    throw new ConditionsNotMetError(
      `ERROR: Config file doesn't exist.\n${config}`
    );
  }
}
