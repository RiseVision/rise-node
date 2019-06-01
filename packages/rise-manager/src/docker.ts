import { leaf, option } from '@carnesen/cli';
import { exec, execSync } from 'child_process';
import * as debug from 'debug';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';

const DOCKER_DIR = 'rise-docker';
const DOCKER_URL = 'https://github.com/RiseVision/rise-node-priv/releases/';
const DOCKER_FILE = 'rise-docker.tar.gz';

const SEC = 1000;
const MIN = 60 * SEC;
const log = debug('manager');

export const docker_start = leaf({
  commandName: 'start',
  description: 'Starts a container using the provided config',

  options: {
    config: option({
      typeName: 'string',
      nullable: true,
      defaultValue: `${DOCKER_DIR}/config.json`,
      description: 'Path to the config file',
    }),
    network: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'mainnet',
      allowedValues: ['mainnet', 'testnet'],
    }),
    foreground: option({
      typeName: 'boolean',
      nullable: true,
      defaultValue: false,
      description: 'Keep the process in the foreground. Implies --show_logs',
    }),
    show_logs: option({
      typeName: 'boolean',
      nullable: true,
      defaultValue: false,
      description: 'Stream the console output',
    }),
  },

  // TODO handle network
  async action({ config, network, foreground, show_logs }) {
    if (!checkDockerDirExists()) {
      return;
    }
    if (!fs.existsSync(config)) {
      console.log("ERROR: Config file doesn't exist.");
      return;
    }
    const showLogs = show_logs || foreground;
    // remember the original cwd
    const cwd = process.cwd();

    // change to the docker dir
    process.chdir(DOCKER_DIR);
    log(`chdir ${DOCKER_DIR}`);

    // TODO extract
    console.log('Building the container...');
    try {
      await new Promise((resolve, reject) => {
        const instance = exec('docker build .');
        log('docker build .');
        instance.stdout.on('data', (data: Buffer) => {
          if (showLogs) {
            process.stdout.write(data);
          } else {
            log(data.toString('utf8'));
          }
        });
      });
    } catch (err) {
      console.log(
        'Error while building the container. Examine the log using --show_logs.'
      );
      console.error(err);
    }

    // TODO extract
    console.log('Stating the container...');
    try {
      const instance = exec(
        `docker run --name rise-node -v ${config}:/home/rise/config.json`
      );

      // TODO await for 'Blockchain ready'
      log('done');
    } catch (e) {
      console.log('Error while running the node:');
      console.error(e);
    } finally {
      process.chdir(cwd);
    }
  },
});

function checkDockerDirExists(): boolean {
  if (!fs.existsSync(DOCKER_DIR) || !fs.lstatSync(DOCKER_DIR).isDirectory()) {
    console.log(`Error: directory '${DOCKER_DIR}' doesn't exist.`);
    console.log(`You can download the latest version using:`);
    console.log(`  ./rise node download`);
    return false;
  }
  return true;
}

export const docker_download = leaf({
  commandName: 'download',
  description:
    'Download a docker release file and extract it to the current directory.',

  options: {
    version: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'latest',
      description: 'Version number to download, eg v2.0.0',
    }),
  },

  async action({ version }) {
    const url = process.env['DEV']
      ? 'http://localhost:8080/rise-docker.tar.gz'
      : DOCKER_URL + version + '/' + DOCKER_FILE;

    console.log(`Downloading ${url}`);

    const file = fs.createWriteStream(DOCKER_FILE);
    // TODO show progress ?
    await new Promise((resolve, reject) => {
      // use plain http when in DEV mode
      (process.env['DEV'] ? http : https)
        .get(url, function(response) {
          response.pipe(file);
          file.on('finish', function() {
            file.close();
            resolve();
          });
        })
        .on('error', function(err) {
          fs.unlink(DOCKER_FILE, () => {
            reject(err.message);
          });
        });
    });

    console.log('Download completed');
    console.log(`Extracting ${DOCKER_FILE}`);

    execSync(`tar -zxf ${DOCKER_FILE}`);
    await new Promise((resolve) => {
      fs.unlink(DOCKER_FILE, resolve);
    });

    console.log('Done.\n');
    console.log('You can start the container using:');
    console.log('  ./rise docker start');
  },
});
