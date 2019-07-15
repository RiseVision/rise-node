// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import * as assert from 'assert';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  checkLaunchpadExists,
  checkNodeDirExists,
  createParseNodeOutput,
  DBConnectionError,
  dbConnectionInfo,
  ConditionsNotMetError,
  extractSourceFile,
  getCoreRiseDir,
  getDBEnvVars,
  getLaunchpadFilePath,
  getNodePID,
  isDevEnv,
  log,
  MIN,
  NativeModulesError,
  NODE_LOCK_FILE,
  printUsingConfig,
} from '../shared/misc';
import {
  configOption,
  foregroundOption,
  IConfig,
  IForeground,
  INetwork,
  IShowLogs,
  networkOption,
  showLogsOption,
} from '../shared/options';
import { nodeRebuildNative } from './rebuild-native';

export type TOptions = IConfig & INetwork & IForeground & IShowLogs;

export default leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    ...configOption,
    ...foregroundOption,
    ...networkOption,
    ...showLogsOption,
  },

  async action(options: TOptions) {
    try {
      await nodeStart(options);
    } catch (e) {
      log(e);
      console.log('Something went wrong. Examine the log using --show_logs.');
      process.exit(1);
    }
  },
});

/**
 * Starts a node or throws an exception.
 */
export async function nodeStart(
  { config, foreground, network, show_logs }: TOptions,
  rebuildNative = true,
  skipPIDCheck = false
) {
  checkConditions(config, skipPIDCheck);

  show_logs = show_logs || foreground;

  printUsingConfig(network, config);
  console.log('Starting RISE node...');

  let ready = false;
  try {
    await startLaunchpad(
      {
        config,
        foreground,
        network,
        show_logs,
      },
      () => {
        ready = true;
      }
    );
    if (!ready || foreground) {
      throw new Error('Never reached "Blockchain ready"');
    }
    if (!foreground) {
      console.log('Node started');
    }
    if (foreground && !isDevEnv()) {
      fs.unlinkSync(NODE_LOCK_FILE);
    }
    log('nodeStart done');
  } catch (err) {
    log(err);
    if (err instanceof NativeModulesError) {
      console.log('Native modules need rebuilding');
      if (rebuildNative) {
        await nodeRebuildNative({ show_logs });
        // try to start the node again, but skipping the rebuild and the
        // PID check
        await nodeStart(
          { config, foreground, network, show_logs },
          false,
          true
        );
      } else {
        log('Automatic rebuild-native failed');
        throw err;
      }
    } else if (err instanceof DBConnectionError) {
      console.log("ERROR: Couldn't connect to the DB");
      console.log(dbConnectionInfo(getDBEnvVars(network, config)));
      throw err;
    }
  }
}

function startLaunchpad(
  { config, network, foreground, show_logs }: TOptions,
  setReady: () => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const cmd = getLaunchpadFilePath();
      const params = ['--net', network];
      if (config) {
        params.push('-e', path.resolve(config));
      }
      log('$', cmd + ' ' + params.join(' '));

      // wait for "Blockchain ready"
      const parseNodeOutput = createParseNodeOutput(
        { foreground, show_logs },
        setReady,
        resolve,
        reject
      );
      // run the command
      const proc = spawn(cmd, params, {
        cwd: getCoreRiseDir(),
        shell: true,
      });
      console.log(`PID ${proc.pid}`);
      // timeout
      const timer = setTimeout(() => {
        if (!proc.killed) {
          console.log(`Timeout (${2 * MIN} secs)`);
          proc.kill();
        }
      }, 2 * MIN);
      proc.stdout.on('data', parseNodeOutput);
      proc.stderr.on('data', parseNodeOutput);
      proc.on('close', (code) => {
        log('close, exit code = ', code);
        clearTimeout(timer);
        code ? reject(code) : resolve(code);
      });

      // quit the child process gracefully
      process.on('SIGINT', () => handleSigInt(proc));

      // save the PID (not in DEV)
      if (!isDevEnv()) {
        log(`Creating lock file ${NODE_LOCK_FILE} (${proc.pid})`);
        fs.writeFileSync(NODE_LOCK_FILE, proc.pid, { encoding: 'utf8' });
      }
    } catch (e) {
      reject(e);
    }
  });
}

function handleSigInt(proc: ChildProcess) {
  log('Caught a SIGINT');
  assert(proc);
  proc.kill();

  if (proc.killed) {
    process.exit();
  } else {
    console.log('Waiting for RISE node to quit...');
  }
}

function checkConditions(config: string, skipPIDCheck = false) {
  if (!checkNodeDirExists(true)) {
    extractSourceFile();
  }
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
