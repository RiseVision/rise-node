// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import * as assert from 'assert';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  checkLaunchpadExists,
  checkNodeDirExists,
  createWaitForReady,
  extractSourceFile,
  getCoreRiseDir,
  getLaunchpadFilePath,
  getNodePID,
  isDevEnv,
  log,
  MIN,
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

  async action({
    config,
    network,
    foreground,
    show_logs,
  }: TOptions): Promise<boolean> {
    if (!checkConditions(config)) {
      return;
    }
    const showLogs = show_logs || foreground;
    const configPath = config ? path.resolve(config) : null;

    printUsingConfig(network, config);
    console.log('Starting RISE node...');
    console.log(`PID ${process.pid}`);

    try {
      let ready = false;
      await new Promise((resolve, reject) => {
        const cmd = getLaunchpadFilePath();
        const params = ['--net', network];
        if (configPath) {
          params.push('-e', configPath);
        }
        log('$', cmd + ' ' + params.join(' '));

        // run the command
        const proc = spawn(cmd, params, {
          cwd: getCoreRiseDir(),
          shell: true,
        });

        // quit the child process gracefully
        process.on('SIGINT', () => handleSigInt(proc));

        // save the PID (not in DEV)
        if (!isDevEnv()) {
          fs.writeFileSync(NODE_LOCK_FILE, proc.pid, { encoding: 'utf8' });
        }
        // wait for "Blockchain ready"
        const waitForReady = createWaitForReady(
          { foreground, showLogs },
          () => {
            ready = true;
          },
          resolve
        );
        // timeout
        const timer = setTimeout(() => {
          if (!ready && !proc.killed) {
            proc.kill();
          }
        }, 2 * MIN);
        proc.stdout.on('data', waitForReady);
        proc.stderr.on('data', waitForReady);
        proc.on('close', (code) => {
          log('close, exit code = ', code);
          clearTimeout(timer);
          code ? reject(code) : resolve(code);
        });
      });
      log('done');
      if (!ready || foreground) {
        console.log('Something went wrong. Examine the log using --show_logs.');
        process.exit(1);
      }
      if (!foreground) {
        console.log('Node started');
      }
      if (foreground && !isDevEnv()) {
        fs.unlinkSync(NODE_LOCK_FILE);
      }
      return;
    } catch (e) {
      console.log('Something went wrong. Examine the log using --show_logs.');
      process.exit(1);
    }
  },
});

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

function checkConditions(config: string): boolean {
  if (!checkNodeDirExists(true)) {
    extractSourceFile();
  }
  if (!checkLaunchpadExists()) {
    return false;
  }
  // check the PID, but not when in DEV
  if (!isDevEnv()) {
    const pid = getNodePID();
    if (pid) {
      console.log(`ERROR: Node already running as PID ${pid}.`);
      return false;
    }
  }
  if (config && !fs.existsSync(config)) {
    console.log(`ERROR: Config file doesn't exist.\n${config}`);
    return false;
  }

  return true;
}
