import { branch, cli, leaf, option } from '@carnesen/cli';
import * as execa from 'execa';
import { resolve } from 'path';
import { Writable } from 'stream';

const SEC = 1000;
const MIN = 60 * SEC;

// ----- COMMANDS

export const node_start = leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    config: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'config.json',
    }),
    network: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'mainnet',
      // TODO limit values
    }),
  },

  async action({ config, network }) {
    // TODO check if in the correct dir
    // TODO check if `./node_modules/.bin/lerna` exists
    const config_path = resolve(config);
    console.log('Stating RISE node...');
    try {
      const lerna_run = new Promise((resolve, reject) => {
        // kill the process after 2 mins
        const timeout = setTimeout(reject.bind(null, 'TIMEOUT'), 2 * MIN);
        // parse the commands output
        const stream = new Writable({
          write(chunk, encoding, callback) {
            // decode
            chunk = chunk.toString('utf8');
            console.log('chunk', chunk);
            // check if the output reached the desired line
            if (chunk.includes('Blockchain ready')) {
              clearTimeout(timeout);
              resolve();
            }
            // mark the chunk as written
            callback();
          },
        });

        const cmd = execa(`./node_modules/.bin/lerna`, [
          'run',
          `start:${network}`,
          `--stream`,
          `--no-prefix`,
          `--`,
          `-e ${config_path}`,
        ])
        cmd.stdout.pipe(stream);
        cmd.stderr.pipe(stream);
      });
      await lerna_run;
      console.log('done');
    } catch (e) {
      console.log('error error error');
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
    
    Examples:
    ./rise-manager node start`,
  subcommands: [docker, node],
});

cli(root)();
