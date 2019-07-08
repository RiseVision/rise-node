// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  checkLernaExists,
  checkNodeDirExists,
  extractRiseNodeFile,
  getLernaFilePath,
  getNodeDir,
  getPID,
  isDevEnv,
  LOCK_FILE,
  log,
  MIN,
  NETWORKS,
  NODE_DIR,
  TNetworkType,
} from '../misc';

export default leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    config: option({
      defaultValue: `${NODE_DIR}/config.json`,
      description: 'Path to the config file',
      nullable: true,
      typeName: 'string',
    }),
    foreground: option({
      defaultValue: false,
      description: 'Keep the process in the foreground. Implies --show_logs',
      nullable: true,
      typeName: 'boolean',
    }),
    network: option({
      allowedValues: NETWORKS,
      defaultValue: 'mainnet',
      nullable: true,
      typeName: 'string',
    }),
    show_logs: option({
      defaultValue: false,
      description: 'Stream the console output',
      nullable: true,
      typeName: 'boolean',
    }),
  },

  async action({ config, network, foreground, show_logs }): Promise<boolean> {
    if (!checkConditions(config)) {
      return false;
    }
    const showLogs = show_logs || foreground;
    const configPath = path.resolve(config);

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

        // quit the child process gracefuly
        process.on('SIGINT', handleSigInt.bind(proc));

        // save the PID (not in DEV)
        if (!isDevEnv()) {
          fs.writeFileSync(LOCK_FILE, proc.pid, { encoding: 'utf8' });
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
        fs.unlinkSync(LOCK_FILE);
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

function createWaitForReady(
  params: { foreground: boolean; showLogs: boolean },
  setReady: () => void,
  resolve: (val?: any) => void
) {
  return (data: string) => {
    // output
    if (params.showLogs) {
      process.stdout.write(data);
    } else {
      log(data);
    }
    // check if the output reached the desired line
    if (data.includes('Blockchain ready')) {
      setReady();
      // keep streaming the output if in the foreground
      if (!params.foreground) {
        resolve();
      }
    }
  };
}

function createCmd(network, configPath) {
  return (
    getLernaFilePath() +
    ' run ' +
    `start:${network} ` +
    '--stream ' +
    '--no-prefix ' +
    '-- ' +
    `-e ${configPath}`
  );
}

function checkConditions(config: string) {
  if (!checkNodeDirExists(true)) {
    extractRiseNodeFile();
  }
  if (!checkLernaExists()) {
    return false;
  }
  // check the PID, but not when in DEV
  if (!isDevEnv()) {
    const pid = getPID();
    if (!isDevEnv() && pid) {
      console.log(`ERROR: Node already running as PID .\n${LOCK_FILE}`);
      return false;
    }
  }
  if (!fs.existsSync(config)) {
    console.log(`ERROR: Config file doesn't exist.\n${config}`);
    return false;
  }
}
