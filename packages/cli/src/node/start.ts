// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  checkLernaExists,
  checkNodeDirExists,
  createWaitForReady,
  extractSourceFile,
  getLernaFilePath,
  getNodeDir,
  getNodePID,
  isDevEnv,
  log,
  MIN,
  NODE_LOCK_FILE,
  TNetworkType,
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

export type TOptions = IConfig &
  INetwork &
  IForeground &
  IShowLogs;

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
    // TODO tmp
    console.log('hd7asasduigfhjdfsds');
    if (!checkConditions(config)) {
      return false;
    }
    const showLogs = show_logs || foreground;
    const configPath = config ? path.resolve(config) : null;

    console.log(`Using config ${configPath}`);
    console.log('Starting RISE node...');

    try {
      let ready = false;
      await new Promise((resolve, reject) => {
        const cmd = createCmd(network, configPath);
        log('$', cmd);
        // run the command
        const proc = exec(cmd, {
          cwd: getNodeDir(),
          timeout: foreground ? 0 : 2 * MIN,
        });

        // quit the child process gracefully
        process.on('SIGINT', handleSigInt.bind(proc));

        // save the PID (not in DEV)
        if (!isDevEnv()) {
          fs.writeFileSync(NODE_LOCK_FILE, proc.pid, { encoding: 'utf8' });
        }
        const waitForReady = createWaitForReady(
          { foreground, showLogs },
          () => {
            ready = true;
          },
          resolve
        );
        proc.stdout.on('data', waitForReady);
        proc.stderr.on('data', waitForReady);
        proc.on('close', (code) => {
          log('close', code);
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
      return true;
    } catch (e) {
      console.log('Something went wrong. Examine the log using --show_logs.');
      console.error(e);
      process.exit(1);
    }
  },
});

function handleSigInt(proc) {
  console.log('Caught interrupt signal');
  proc.kill();

  if (proc.killed) {
    process.exit();
  } else {
    console.log('Waiting for RISE node to quit...');
  }
}

function createCmd(network: TNetworkType, configPath?: string | null) {
  return (
    getLernaFilePath() +
    ' run ' +
    `start:${network} ` +
    '--stream ' +
    '--no-prefix ' +
    '-- ' +
    (configPath ? `-e ${configPath}` : '')
  );
}

function checkConditions(config: string): boolean {
  if (!checkNodeDirExists(true)) {
    extractSourceFile();
  }
  if (!checkLernaExists()) {
    return false;
  }
  // check the PID, but not when in DEV
  if (!isDevEnv()) {
    const pid = getNodePID();
    if (pid) {
      console.log(`ERROR: Node already running as PID .\n${NODE_LOCK_FILE}`);
      return false;
    }
  }
  if (config && !fs.existsSync(config)) {
    console.log(`ERROR: Config file doesn't exist.\n${config}`);
    return false;
  }

  return true;
}
