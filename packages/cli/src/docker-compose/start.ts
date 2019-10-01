// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import { dockerRemove, dockerStop } from '../docker/build';
import { DOCKER_DIR, MIN } from '../shared/constants';
import { getDockerDir } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  foregroundOption,
  IForeground,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';

export type TOptions = INetwork & IForeground & IVerbose;

export default leaf({
  commandName: 'start',
  description: 'Starts a container using the provided config',

  options: {
    ...foregroundOption,
    ...networkOption,
    ...verboseOption,
  },

  async action({ network, foreground, verbose }: TOptions) {
    if (!checkDockerDirExists()) {
      return;
    }
    verbose = verbose || foreground;

    // TODO check if docker is running
    try {
      await dockerComposeStop();
      await dockerStop();
      await dockerRemove();
      await dockerBuild(verbose);
      await dockerRun(network, foreground, verbose);
    } catch (err) {
      log(
        'Error while building the container.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      console.error(err);
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

async function dockerComposeStop(): Promise<void> {
  let cmd;

  log('Stopping docker compose...');

  cmd = 'docker-compose stop rise-node';
  debug('$', cmd);
  try {
    execSync(cmd, {
      cwd: DOCKER_DIR,
    });
  } catch (e) {
    debug(e);
  }
}

async function dockerBuild(verbose: boolean): Promise<void> {
  log('Building the image...');

  // build
  await new Promise((resolve, reject) => {
    const cmd = 'docker-compose build';
    debug('$', cmd);
    const proc = exec(cmd, {
      cwd: getDockerDir(),
      timeout: 15 * MIN,
    });
    function line(data: string) {
      if (verbose) {
        process.stdout.write(data);
      } else {
        debug(data);
      }
    }
    proc.stdout.on('data', line);
    proc.stderr.on('data', line);
    proc.on('close', (code) => {
      debug('close', code);
      code ? reject(code) : resolve(code);
    });
  });

  debug('build done');
  log('Build complete');
}

async function dockerRun(
  network: string,
  foreground: boolean,
  verbose: boolean
) {
  log('Starting containers...');
  let ready = false;
  await new Promise((resolve, reject) => {
    const cmd = 'docker-compose up';
    debug('$', cmd);
    const proc = exec(cmd, {
      cwd: getDockerDir(),
      env: {
        NETWORK: network,
      },
      timeout: 2 * MIN,
    });
    function line(data: string) {
      if (verbose) {
        process.stdout.write(data);
      } else {
        debug(data);
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
      debug('close', code);
      code ? reject(code) : resolve(code);
    });
  });
  debug('run done');
  if (!ready) {
    log(
      'Something went wrong.' +
        (verbose ? '' : 'Examine the log using --verbose.')
    );
    process.exit(1);
  }
  log('Container started');
  // TODO print the IP and the hostname for the node
}

function checkDockerDirExists(): boolean {
  if (!fs.existsSync(DOCKER_DIR) || !fs.lstatSync(DOCKER_DIR).isDirectory()) {
    log(`Error: directory '${DOCKER_DIR}' doesn't exist.`);
    log('You can download the latest version using:');
    log('  ./rise download');
    return false;
  }
  return true;
}
