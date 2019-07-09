// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  checkDockerDirExists,
  DOCKER_CONFIG_FILE,
  getDockerDir,
  log,
  MIN,
} from '../shared/misc';
import {
  configOption,
  foregroundOption,
  IConfig,
  IForeground,
  IShowLogs,
  showLogsOption,
} from '../shared/options';

export type TOptions = IConfig & IForeground & IShowLogs;

export default leaf({
  commandName: 'build',
  description: 'Rebuilds an image',

  options: {
    ...configOption,
    ...foregroundOption,
    ...showLogsOption,
  },

  async action({ config, foreground, show_logs }: TOptions) {
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
      log(`Using config: ${configFile}`);
      fs.copyFileSync(path.resolve(config), DOCKER_CONFIG_FILE);
    } else {
      createEmptyConfig();
    }
    const showLogs = show_logs || foreground;

    // TODO check if docker is running
    try {
      await dockerStop();
      await dockerRemove();
      await dockerBuild(showLogs);
    } catch (err) {
      console.log(
        'Error while building the container. Examine the log using --show_logs.'
      );
      console.error(err);
      process.exit(1);
    } finally {
      // remove the temp config
      fs.unlinkSync(DOCKER_CONFIG_FILE);
    }
  },
});

function createEmptyConfig() {
  fs.writeFileSync(DOCKER_CONFIG_FILE, '{}', {
    encoding: 'utf8',
  });
}

export async function dockerStop(): Promise<void> {
  console.log('Stopping the previous container...');

  const cmd = 'docker stop rise-node';
  log('$', cmd);
  try {
    execSync(cmd);
  } catch (e) {
    log(e);
  }
}

// tslint:disable-next-line:no-identical-functions
export async function dockerRemove(): Promise<void> {
  console.log('Removing the previous container...');

  const cmd = 'docker rm rise-node';
  log('$', cmd);
  try {
    execSync(cmd);
  } catch (e) {
    log(e);
  }
}

async function dockerBuild(showLogs: boolean): Promise<void> {
  console.log('Building the image...');

  // build
  await new Promise((resolve, reject) => {
    const cmd = 'docker';
    const params = ['build', '-t', 'rise-local/node', '.'];
    log('$', cmd + params.join(' '));
    const proc = spawn(cmd, params, {
      cwd: getDockerDir(),
    });
    function line(data: string) {
      if (showLogs) {
        process.stdout.write(data);
      } else {
        log(data);
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
      log('close', code);
      clearTimeout(timer);
      code ? reject(code) : resolve(code);
    });
  });

  log('build done');
  console.log('Build complete');
}
