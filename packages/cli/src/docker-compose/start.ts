// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { dockerRemove, dockerStop } from '../docker/build';
import { DOCKER_DIR, getDockerDir, log, MIN, NETWORKS } from '../misc';

export default leaf({
  commandName: 'start',
  description: 'Starts a container using the provided config',

  options: {
    config: option({
      defaultValue: `${DOCKER_DIR}/config.json`,
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

  async action({ config, network, foreground, show_logs }) {
    if (!checkDockerDirExists()) {
      return;
    }
    const configPath = path.resolve(config);
    if (!fs.existsSync(configPath)) {
      console.log("ERROR: Config file doesn't exist.");
      return;
    }
    const showLogs = show_logs || foreground;

    // TODO check if docker is running
    try {
      await dockerComposeStop();
      await dockerStop();
      await dockerRemove();
      await dockerBuild(showLogs);
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

async function dockerComposeStop(): Promise<void> {
  let cmd;

  console.log('Stopping docker compose...');

  cmd = 'docker-compose stop rise-node';
  log('$', cmd);
  try {
    execSync(cmd, {
      cwd: DOCKER_DIR,
    });
  } catch (e) {
    log(e);
  }
}

async function dockerBuild(showLogs: boolean): Promise<void> {
  console.log('Building the image...');

  // build
  await new Promise((resolve, reject) => {
    const cmd = 'docker-compose build';
    log('$', cmd);
    const proc = exec(cmd, {
      cwd: getDockerDir(),
      timeout: 5 * MIN,
    });
    function line(data: string) {
      if (showLogs) {
        process.stdout.write(data);
      } else {
        log(data);
      }
    }
    proc.stdout.on('data', line);
    proc.stderr.on('data', line);
    proc.on('close', (code) => {
      log('close', code);
      code ? reject(code) : resolve(code);
    });
  });

  log('build done');
  console.log('Build complete');
}

async function dockerRun(
  config: string,
  network: string,
  foreground: boolean,
  showLogs: boolean
) {
  console.log(`Using config ${config}`);

  console.log('Starting containers...');
  let ready = false;
  await new Promise((resolve, reject) => {
    const cmd = 'docker-compose up';
    log('$', cmd);
    const proc = exec(cmd, {
      cwd: getDockerDir(),
      env: {
        NETWORK: network,
      },
      timeout: 2 * MIN,
    });
    function line(data: string) {
      if (showLogs) {
        process.stdout.write(data);
      } else {
        log(data);
      }
      // check if the output reached the desired line
      if (data.includes('Blockchain ready')) {
        ready = true;
        // keep streaming the output if in the foreground
        if (!foreground) {
          resolve();
        }
      }
    }
    proc.stdout.on('data', line);
    proc.stderr.on('data', line);
    proc.on('close', (code) => {
      log('close', code);
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
