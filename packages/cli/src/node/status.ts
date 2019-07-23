// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import * as fs from 'fs';
import {
  checkNodeDirExists,
  ConditionsNotMetError,
  extractSourceFile,
  getBlockHeight,
  getNodePID,
  log,
  printUsingConfig,
} from '../shared/misc';
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
  description: 'Show the status of a running RISE node',

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
  },

  async action(options: TOptions) {
    try {
      await nodeStatus(options);
    } catch (e) {
      log(e);
      console.log('Something went wrong. Examine the log using --verbose.');
      process.exit(1);
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
    console.log("RISE node isn't running");
    return;
  }

  console.log(`PID: ${pid}`);
  log('Getting block height from the DB...');

  const blockHeight = await getBlockHeight(network, config, verbose);
  if (!blockHeight) {
    throw new Error("ERROR: Couldn't get the block height");
  }

  console.log(`Block height: ${blockHeight}`);
}

async function checkConditions(config: string) {
  if (!checkNodeDirExists(true)) {
    await extractSourceFile();
  }
  if (config && !fs.existsSync(config)) {
    throw new ConditionsNotMetError(
      `ERROR: Config file doesn't exist.\n${config}`
    );
  }
}
