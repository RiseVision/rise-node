// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import axios from 'axios';
import fs from 'fs';
import { ConfigMissingError, handleCLIError } from '../shared/exceptions';
import { checkSourceDir, getNodePID, getNodeState } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  dbConnectionInfo,
  getBlockHeight,
  getDBEnvVars,
  mergeConfig,
  printUsingConfig,
  runSQL,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IV1,
  IVerbose,
  networkOption,
  v1Option,
  verboseOption,
} from '../shared/options';

export type TOptions = IConfig &
  INetwork &
  IV1 &
  IVerbose & { skipSync?: boolean } & { skipDB?: boolean };

export default leaf({
  commandName: 'status',
  description: 'Show the status of a running RISE Node',

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
    ...v1Option,
    'skip-db': option({
      defaultValue: false,
      description: 'Skip showing of the DB info and status',
      nullable: false,
      typeName: 'boolean',
    }),
    'skip-sync': option({
      defaultValue: false,
      description: 'Skip showing of the sync progress and connected peers',
      nullable: false,
      typeName: 'boolean',
    }),
  },

  async action(options: TOptions) {
    options.skipSync = options['skip-sync'];
    options.skipDB = options['skip-db'];

    if (options.v1 && !options.config) {
      // TODO extract
      options.config = 'etc/node_config.json';
    }

    try {
      await nodeStatus(options);
    } catch (err) {
      debug(err);
      if (options.verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong.' +
          (options.verbose
            ? ''
            : ' Examine the log using --verbose and make sure you use the ' +
              '--network param in case of testnet / devnet.')
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
  const state = getNodeState();
  log(`State: ${state || 'off'}`);
  if (pid) {
    log(`PID: ${pid}`);
  }
}

/**
 * Starts a node or throws an exception.
 */
export async function nodeStatus({
  config,
  network,
  verbose,
  skipSync,
  skipDB,
}: TOptions) {
  try {
    log(`Network: ${network}`);

    await checkConditions(config);

    if (verbose) {
      printUsingConfig(network, config);
    }

    // check the PID, but not when in DEV
    const pid = getNodePID();
    showPID(pid);

    try {
      await showBlockHeight(network, config, verbose);
    } catch {
      // empty
    }

    const options = { config, network, verbose };

    if (!skipDB) {
      await showDBStatus(options);
      showDBVars(options);
    }

    if (pid && !skipSync) {
      await showPeers(options);
      await showSync(options);
    }
  } catch (err) {
    handleCLIError(err);
  }
}

async function showPeers(options: TOptions) {
  const res = await apiReq(options, '/api/peers');
  log(`Connected peers: ${res.peers.length}`);
}

async function showSync(options: TOptions) {
  const res = await apiReq(options, '/api/peers');
  const networkHeight = res.peers.reduce((height, peer) => {
    return height < peer.height ? peer.height : height;
  }, 0);
  const blockHeight = await getBlockHeight(
    options.network,
    options.config,
    options.verbose
  );
  log(`Network height: ${networkHeight}`);
  if (networkHeight) {
    const percent = (blockHeight / networkHeight) * 100;
    log(`Sync progress: ${Math.floor(percent)}%`);
  }
}

async function showDBStatus(options: TOptions) {
  try {
    await runSQL(
      'select height from blocks order by height desc limit 1;',
      options.network,
      options.config,
      options.verbose
    );
    log('DB status: running');
  } catch {
    log('DB status: unavailable');
  }
}

function showDBVars(options: TOptions) {
  const vars = dbConnectionInfo(getDBEnvVars(options.network, options.config))
    .split('\n')
    .map((row) => '  ' + row);
  log(vars.join('\n'));
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
    throw new ConfigMissingError(config);
  }
}
