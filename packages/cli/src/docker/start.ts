// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  createWaitForReady,
  DOCKER_CONTAINER_NAME,
  DOCKER_DIR,
  DOCKER_IMAGE_NAME,
  getDockerDir,
  log,
  MIN,
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
import { dockerRemove, dockerStop } from './build';

export type TOptions = IConfig & INetwork & IForeground & IShowLogs;

export default leaf({
  commandName: 'start',
  description: 'Starts a container using the provided config',

  options: {
    ...configOption,
    ...foregroundOption,
    ...networkOption,
    ...showLogsOption,
  },

  async action({ config, network, foreground, show_logs }: TOptions) {
    if (!checkDockerDirExists()) {
      return;
    }
    const configPath = config ? path.resolve(config) : null;
    if (configPath && !fs.existsSync(configPath)) {
      console.log("ERROR: Config file doesn't exist.");
      return;
    }
    const showLogs = show_logs || foreground;

    // TODO check if docker is running
    try {
      await dockerStop();
      await dockerRemove();
      await dockerRun(configPath, network, foreground, showLogs);
    } catch (err) {
      console.log(
        'Error while building the container. Examine the log using --show_logs.'
      );
      console.error(err);
      process.exit(1);
    }
  },
});

async function dockerRun(
  config: string,
  network: TNetworkType,
  foreground: boolean,
  showLogs: boolean
) {
  if (config) {
    console.log(`Using config ${config}`);
  }

  console.log('Starting the container...');
  let ready = false;
  await new Promise((resolve, reject) => {
    const cmd = 'docker';
    const params = [
      'run',
      '--name',
      DOCKER_CONTAINER_NAME,
      ...(config ? ['-v', `${config}:/home/rise/config.json`] : []),
      DOCKER_IMAGE_NAME,
    ];
    log('$', cmd + ' ' + params.join(' '));
    const proc = spawn(cmd, params, {
      cwd: getDockerDir(),
      env: {
        NETWORK: network,
      },
      shell: true,
    });
    const waitForReady = createWaitForReady(
      { foreground, showLogs },
      () => {
        ready = true;
      },
      resolve
    );
    const timer = setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
      }
    }, 2 * MIN);
    proc.stdout.on('data', waitForReady);
    proc.stderr.on('data', waitForReady);
    proc.on('close', (code) => {
      log('close', code);
      clearTimeout(timer);
      code ? reject(code) : resolve(code);
    });
  });
  log('run done');
  if (!ready) {
    console.log('Something went wrong. Examine the log using --show_logs.');
    process.exit(1);
  }
  console.log('Container started');
}

function checkDockerDirExists(): boolean {
  if (!fs.existsSync(DOCKER_DIR) || !fs.lstatSync(DOCKER_DIR).isDirectory()) {
    console.log(`Error: directory '${DOCKER_DIR}' doesn't exist.`);
    console.log('You can download the latest version using:');
    console.log('  ./rise docker download');
    return false;
  }
  return true;
}
