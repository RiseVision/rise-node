import { branch, cli, leaf, option } from '@carnesen/cli';
import { exec } from 'child_process';
import * as debug from 'debug';
import { resolve } from 'path';

const SEC = 1000;
const MIN = 60 * SEC;
const log = debug('manager');

// ----- COMMANDS

export const node_start = leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    config: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'config.json',
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
      description: 'Keep the process in the foreground. Implies --showLog',
    }),
    show_log: option({
      typeName: 'boolean',
      nullable: true,
      defaultValue: false,
      description: 'Stream the console output',
    }),
  },

  async action({ config, network, foreground, show_log }) {
    // TODO check if in the correct dir
    // TODO check if `./node_modules/.bin/lerna` exists
    const showLog = show_log || foreground;
    const config_path = resolve(config);
    console.log('Stating RISE node...');
    let ready = false;
    try {
      await new Promise((resolve, reject) => {
        // kill the process after 2 mins
        const timeout = setTimeout(reject.bind(null, 'TIMEOUT'), 2 * MIN);

        const cmd = exec(
          './node_modules/.bin/lerna run ' +
            `start:${network} ` +
            '--stream ' +
            '--no-prefix ' +
            '-- ' +
            `-e ${config_path}`
        );

        cmd.stdout.on('data', (data) => {
          // output
          if (showLog) {
            process.stdout.write(data);
          } else {
            data = data.toString('utf8');
            log(data);
          }
          // check if the output reached the desired line
          if (data.includes('Blockchain ready')) {
            clearTimeout(timeout);
            ready = true;
            // keep streaming the output if in foreground
            if (!foreground) {
              resolve();
            }
          }
        });

        cmd.stderr.on('data', (data) => {
          // output
          if (showLog) {
            process.stdout.write(data);
          } else {
            data = data.toString('utf8');
            log('err', data);
          }
        });

        cmd.stderr.on('close', (code) => {
          log('close', code);
          code ? reject(code) : resolve(code);
        });
      });
      log('done');
      if (!ready && !showLog) {
        console.log('Something went wrong. Examine the log using --show_log.');
        process.exit(1);
      }
    } catch (e) {
      console.log('Error while running the node:');
      console.error(e);
      debugger;
    }
  },
});

export const docker_start = leaf({
  commandName: 'start',
  description: 'Starts the container using config.json',

  async action() {
    // TODO check if in the correct dir
    // await execa('docker-compose build; docker-compose up', 'Blockchain ready');
    console.log('Docker started');
  },
});

// ----- BRANCHES

export const node = branch({
  commandName: 'node',
  description: 'Node related commands',
  subcommands: [node_start],
});

export const docker = branch({
  commandName: 'docker',
  description: 'Docker related commands',
  subcommands: [docker_start],
});

export const root = branch({
  commandName: 'rise-manager',
  description: `
    Manager your RISE node instance, including docker images.

    Usage:
    ./rise-manager node start
    ./rise-manager docker start
    ./rise-manager node download
    ./rise-manager docker download
    `,
  subcommands: [docker, node],
});

cli(root)();
