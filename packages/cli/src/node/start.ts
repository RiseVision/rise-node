// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import assert from 'assert';
import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { MIN } from '../shared/constants';
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
import {
  createParseNodeOutput,
  dbConnectionInfo,
  execCmd,
  getDBEnvVars,
  isDevEnv,
  log,
  mergeConfig,
  printUsingConfig,
} from '../shared/misc';
import {
  configOption,
  foregroundOption,
  IConfig,
  IForeground,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';
import { nodeRebuildNative } from './rebuild-native';

export type TOptions = IConfig &
  INetwork &
  IForeground &
  IVerbose & { v1?: boolean };

export default leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    ...configOption,
    ...foregroundOption,
    ...networkOption,
    ...verboseOption,
    v1: {
      defaultValue: false,
      description: 'Use the V1 config and DB',
      nullable: true,
      typeName: 'boolean',
    },
  },

  async action(options: TOptions) {
    try {
      await nodeStart(options);
    } catch (err) {
      log(err);
      if (options.verbose) {
        console.log(err);
      }
      console.log(
        '\nSomething went wrong. ' +
          (options.verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

/**
 * Starts a node or throws an exception.
 */
export async function nodeStart(
  { config, foreground, network, verbose, v1 }: TOptions,
  rebuildNative = true,
  skipPIDCheck = false
) {
  try {
    await checkConditions(config, skipPIDCheck);

    if (v1 && !config) {
      config = 'etc/node_config.json';
    }

    if (verbose) {
      printUsingConfig(network, config);
    }
    console.log('Starting RISE node...');

    let ready = false;
    removeNodeLock();

    if (v1) {
      // TODO check if in the v1 dir when --v1
      console.log('Starting the v1 DB');
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
      },
      () => {
        ready = true;
      }
    );
    if (!foreground) {
      if (ready) {
        console.log('RISE node started');
      } else {
        console.log('RISE node NOT started');
      }
    }
    if (!ready) {
      throw new Error('Never reached "Blockchain ready"');
    }
  } catch (err) {
    log(err);
    if (err instanceof NativeModulesError) {
      console.log('Native modules need rebuilding');
      if (rebuildNative) {
        await nodeRebuildNative({ verbose });
        // try to start the node again, but skipping the rebuild and the
        // PID check
        await nodeStart({ config, foreground, network, verbose }, false, true);
      } else {
        log('Automatic rebuild-native failed');
        throw err;
      }
    } else if (err instanceof DBConnectionError) {
      console.log("ERROR: Couldn't connect to the DB");
      console.log(dbConnectionInfo(getDBEnvVars(network, config)));
      throw err;
    } else if (err instanceof AddressInUseError) {
      console.log('ERROR: Address currently in use. Another node running?');
      throw err;
    } else {
      throw err;
    }
  }
}

// TODO simplify
// tslint:disable-next-line:cognitive-complexity
function startLaunchpad(
  { config, network, foreground, verbose }: TOptions,
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
      log('$', cmd + ' ' + params.join(' '));

      // wait for "Blockchain ready"
      const parseNodeOutput = createParseNodeOutput(
        { foreground, verbose },
        () => {
          setReady();
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
        setNodeLock(proc.pid);
      }

      console.log(`Starting as PID ${proc.pid}...`);
      // timeout (not when in foreground)
      const timer = !foreground
        ? setTimeout(() => {
            if (!proc.killed) {
              console.log(`Timeout (${timeout} secs)`);
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
        log('close, exit code = ', code);
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
  log('Caught a SIGINT');
  assert(proc);
  process.kill(proc.pid);

  if (proc.killed) {
    process.exit();
  } else {
    console.log('Waiting for RISE node to quit...');
  }

  removeNodeLock();
}

async function checkConditions(config: string, skipPIDCheck = false) {
  await checkSourceDir();
  checkLaunchpadExists();
  // check the PID, but not when in DEV
  if (!isDevEnv() && !skipPIDCheck) {
    const pid = getNodePID();
    if (pid) {
      throw new ConditionsNotMetError(
        `ERROR: Node already running as PID ${pid}.`
      );
    }
  }
  if (config && !fs.existsSync(config)) {
    throw new ConditionsNotMetError(
      `ERROR: Config file doesn't exist.\n${config}`
    );
  }
}
