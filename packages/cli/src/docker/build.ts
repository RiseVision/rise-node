// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  DOCKER_CONFIG_FILE,
  DOCKER_CONTAINER_NAME,
  DOCKER_IMAGE_NAME,
  MIN,
} from '../shared/constants';
import { checkDockerDirExists, getDockerDir } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  configOption,
  foregroundOption,
  IConfig,
  IForeground,
  IVerbose,
  verboseOption,
} from '../shared/options';

export type TOptions = IConfig & IForeground & IVerbose;

export default leaf({
  commandName: 'build',
  description: 'Rebuilds the image',

  options: {
    ...configOption,
    ...foregroundOption,
    ...verboseOption,
  },

  async action({ config, foreground, verbose }: TOptions) {
    if (!checkDockerDirExists()) {
      return;
    }
    // handle the config
    if (config) {
      try {
        fs.unlinkSync(DOCKER_CONFIG_FILE);
      } catch {
        // empty
      }
      const configFile = path.resolve(config);
      debug(`Using config: ${configFile}`);
      fs.copyFileSync(path.resolve(config), DOCKER_CONFIG_FILE);
    } else {
      createEmptyConfig();
    }
    verbose = verbose || foreground;

    // TODO check if docker is running
    try {
      await dockerStop();
      await dockerRemove();
      await dockerBuild(verbose);
    } catch (err) {
      log(
        'Error while building the container.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      console.error(err);
      process.exit(1);
    } finally {
      // remove the temp config
      fs.unlinkSync(DOCKER_CONFIG_FILE);
      closeLog();
    }
  },
});

function createEmptyConfig() {
  fs.writeFileSync(DOCKER_CONFIG_FILE, '{}', {
    encoding: 'utf8',
  });
}

export async function dockerStop(): Promise<void> {
  log('Stopping the previous container...');

  const cmd = `docker stop ${DOCKER_CONTAINER_NAME}`;
  debug('$', cmd);
  try {
    execSync(cmd);
  } catch (e) {
    debug(e);
  }
}

// tslint:disable-next-line:no-identical-functions
export async function dockerRemove(): Promise<void> {
  log('Removing the previous container...');

  const cmd = `docker rm ${DOCKER_CONTAINER_NAME}`;
  debug('$', cmd);
  try {
    execSync(cmd);
  } catch (e) {
    debug(e);
  }
}

async function dockerBuild(verbose: boolean): Promise<void> {
  log('Building the image...');

  // build
  await new Promise((resolve, reject) => {
    const cmd = 'docker';
    const params = ['build', '-t', DOCKER_IMAGE_NAME, '.'];
    debug('$', cmd + ' ' + params.join(' '));
    const proc = spawn(cmd, params, {
      cwd: getDockerDir(),
      shell: true,
    });
    function line(data: string) {
      if (verbose) {
        process.stdout.write(data);
      } else {
        debug(data);
      }
    }
    const timer = setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
      }
    }, 2 * MIN);
    proc.stdout.on('data', line);
    proc.stderr.on('data', line);
    proc.on('close', (code) => {
      debug('close', code);
      clearTimeout(timer);
      code ? reject(code) : resolve(code);
    });
  });

  debug('build done');
  log('Build complete');
}
