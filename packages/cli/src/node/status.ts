// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import axios from 'axios';
import fs from 'fs';
import { ConditionsNotMetError } from '../shared/exceptions';
import { checkSourceDir, getNodePID, getNodeState } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import { getBlockHeight, mergeConfig, printUsingConfig } from '../shared/misc';
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
          (options.verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

async function showBlockHeight(network, config, verbose) {
  debug('Getting block height from the DB...');

  const blockHeight = await getBlockHeight(network, config, verbose);
  if (!blockHeight) {
    throw new Error("ERROR: Couldn't get the block height");
  }

  log(`Block height: ${blockHeight}`);
}

function showPID(pid) {
  log(`PID: ${pid}`);
  const state = getNodeState();
  log(`PID state: ${state}`);
}

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
  if (pid) {
    showPID(pid);
  }

  await showBlockHeight(network, config, verbose);

  if (pid) {
    await showPeers({ config, network, verbose });
  }
}

async function showPeers(options: TOptions) {
  const res = await apiReq(options, '/api/peers');
  log(`Connected peers: ${res.peers.length}`);
}

async function apiReq(
  { config, network, verbose }: TOptions,
  uri: string
): Promise<any> {
  const mergedConfig = mergeConfig(network, config);
  const host =
    mergedConfig.address === '0.0.0.0' ? 'localhost' : mergedConfig.address;
  // TODO SSL?
  const apiURL = 'http://' + host + ':' + mergedConfig.api.port;
  const url = apiURL + uri;

  const res = await axios.get(url);
  return res.data;
}

async function checkConditions(config: string) {
  await checkSourceDir();
  if (config && !fs.existsSync(config)) {
    throw new ConditionsNotMetError(
      `ERROR: Config file doesn't exist.\n${config}`
    );
  }
}
