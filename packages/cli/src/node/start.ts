// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import assert from 'assert';
import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { MIN, NodeStates } from '../shared/constants';
import {
  AddressInUseError,
  ConditionsNotMetError,
  DBConnectionError,
  NativeModulesError,
} from '../shared/exceptions';
import {
  checkLaunchpadExists,
  checkSourceDir,
  getCoreRiseDir,
  getLaunchpadFilePath,
  getNodePID,
  removeNodeLock,
  setNodeLock,
} from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  createParseNodeOutput,
  dbConnectionInfo,
  execCmd,
  getDBEnvVars,
  isDevEnv,
  mergeConfig,
  printUsingConfig,
} from '../shared/misc';
import {
  configOption,
  crontabOption,
  foregroundOption,
  IConfig,
  ICrontab,
  IForeground,
  INetwork,
  IV1,
  IVerbose,
  networkOption,
  v1Option,
  verboseOption,
} from '../shared/options';
import { nodeCrontab } from './crontab';
import { nodeRebuildNative } from './rebuild-native';
import { nodeStop } from './stop';

export type TOptions = IConfig &
  INetwork &
  IForeground &
  IVerbose &
  IV1 &
  ICrontab & { restart?: boolean } & { verifySnapshot?: boolean };

export default leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    ...configOption,
    ...foregroundOption,
    ...networkOption,
    ...verboseOption,
    restart: option({
      defaultValue: false,
      description: 'Stop a node if already running',
      nullable: true,
      typeName: 'boolean',
    }),
    ...v1Option,
    ...crontabOption,
    verifySnapshot: option({
      defaultValue: false,
      description: 'Run in the snapshot verification mode and exit (or fail)',
      nullable: true,
      typeName: 'boolean',
    }),
  },

  async action(options: TOptions) {
    try {
      await nodeStart(options);
    } catch (err) {
      debug(err);
      if (options.verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong. ' +
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
export async function nodeStart(
  {
    config,
    foreground,
    network,
    verbose,
    v1,
    restart,
    crontab,
    verifySnapshot,
  }: TOptions,
  rebuildNative = true,
  skipPIDCheck = false
) {
  try {
    await checkConditions({ config, verbose, restart }, skipPIDCheck);

    if (v1 && !config) {
      // TODO extract
      config = 'etc/node_config.json';
    }

    if (verbose) {
      printUsingConfig(network, config);
    }
    log('Starting RISE Node...');

    let ready = false;
    removeNodeLock();

    // add the crontab entry if requested
    if (crontab) {
      await nodeCrontab({ verbose, config, network, v1 });
    }

    if (v1) {
      // TODO check if in the v1 dir when --v1
      // TODO extract along with stop.ts
      log('Starting the v1 DB');
      await execCmd(
        './manager.sh',
        ['start', 'db'],
        "Couldn't start the v1 DB"
      );
    }

    await startLaunchpad(
      {
        config,
        foreground,
        network,
        verbose,
        verifySnapshot,
      },
      () => {
        ready = true;
      }
    );
    if (!foreground) {
      if (ready) {
        log('RISE Node started');
      } else {
        log('RISE Node NOT started');
      }
    }
    if (!ready && !verifySnapshot) {
      throw new Error('Never reached "Blockchain ready"');
    }
  } catch (err) {
    debug(err);
    if (err instanceof NativeModulesError) {
      log('Native modules need rebuilding');
      if (rebuildNative) {
        await nodeRebuildNative({ verbose });
        // try to start the node again, but skipping the rebuild and the
        // PID check
        await nodeStart({ config, foreground, network, verbose }, false, true);
      } else {
        debug('Automatic rebuild-native failed');
        throw err;
      }
    } else if (err instanceof DBConnectionError) {
      log("ERROR: Couldn't connect to the DB");
      log(dbConnectionInfo(getDBEnvVars(network, config)));
      throw err;
    } else if (err instanceof AddressInUseError) {
      log('ERROR: Address currently in use. Another node running?');
      throw err;
    } else {
      throw err;
    }
  }
}

// TODO simplify
// tslint:disable-next-line:cognitive-complexity
function startLaunchpad(
  { config, network, foreground, verbose, verifySnapshot }: TOptions,
  setReady: () => void
): Promise<any> {
  const timeout = 2 * MIN;
  const mergedConfig = mergeConfig(network, config);
  return new Promise((resolve, reject) => {
    try {
      const cmd = getLaunchpadFilePath();
      const params = ['--net', network];
      // increase the log level to properly read the console output
      if (mergedConfig.consoleLogLevel === 'error') {
        params.push('--override-config', 'consoleLogLevel="info"');
      }
      if (config) {
        params.push('-e', path.resolve(config));
      }
      if (verifySnapshot) {
        params.push(
          '-s',
          '--override-config',
          // TODO test this works
          `db.database="${mergedConfig.db.database}_snap"`
        );
      }
      debug('$', cmd + ' ' + params.join(' '));

      // wait for "Blockchain ready"
      const parseNodeOutput = createParseNodeOutput(
        { foreground, verbose },
        () => {
          setReady();
          setNodeLock(proc.pid, NodeStates.READY);
          if (!foreground) {
            resolve();
          }
        },
        resolve,
        reject
      );
      // run the command
      const proc = spawn(cmd, params, {
        cwd: getCoreRiseDir(),
        shell: true,
      });

      // save the PID (not in DEV)
      if (!isDevEnv()) {
        setNodeLock(proc.pid, NodeStates.STARTING);
      }

      log(`Starting as PID ${proc.pid}...`);
      // timeout (not when in foreground)
      const timer = !foreground
        ? setTimeout(() => {
            if (!proc.killed) {
              log(`Timeout (${timeout} secs)`);
              proc.kill();
            }
          }, timeout)
        : null;
      proc.stdout.on('data', parseNodeOutput);
      proc.stderr.on('data', parseNodeOutput);
      proc.on('error', (error) => {
        reject(error);
      });
      proc.on('close', (code) => {
        debug('close, exit code = ', code);
        if (!foreground) {
          clearTimeout(timer);
        }
        code ? reject(code) : resolve(code);
      });

      // quit the child process gracefully
      process.on('SIGINT', () => handleSigInt(proc));
    } catch (e) {
      reject(e);
    }
  });
}

function handleSigInt(proc: ChildProcess) {
  debug('Caught a SIGINT');
  assert(proc);
  process.kill(proc.pid);

  if (proc.killed) {
    process.exit();
  } else {
    log('Waiting for RISE Node to quit...');
  }

  removeNodeLock();
}

async function checkConditions(
  // TODO narrow down TOptions
  { config, verbose, restart }: TOptions,
  skipPIDCheck = false
) {
  await checkSourceDir();
  checkLaunchpadExists();
  // check the PID, but not when in DEV
  if (!isDevEnv() && !skipPIDCheck) {
    const pid = getNodePID();
    if (pid && !restart) {
      throw new ConditionsNotMetError(
        `ERROR: Node already running as PID ${pid}, stop it or use --restart`
      );
    } else if (pid && restart) {
      await nodeStop({ verbose });
    }
  }
  if (config && !fs.existsSync(config)) {
    throw new ConditionsNotMetError(
      `ERROR: Config file doesn't exist.\n${config}`
    );
  }
}
