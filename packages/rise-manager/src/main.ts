import { branch, cli, leaf, option } from '@carnesen/cli';
import { process as exec } from 'core-worker';
import { resolve } from 'path';

// ----- COMMANDS

export const docker_start = leaf({
  commandName: 'start',
  description: 'Starts the container using config.json',

  async action() {
    // TODO check if in the correct dir
    await exec(
      'docker-compose build; docker-compose up',
      'Blockchain ready'
    );
    console.log('Docker started');
  },
});

export const node_start = leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    config: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'config.json',
    }),
  },

  async action({ config }) {
    // TODO check if in the correct dir
    const config_path = resolve(config);
    await exec(
      `./node_modules/.bin/lerna run ` +
        `start:$NETWORK --stream --no-prefix --` +
        `-e ${config_path}`,
      'Blockchain ready'
    );
    console.log('Node started');
  },
});

// ----- BRANCHES

export const node = branch({
  commandName: 'node',
  description: 'Node related commands',
  subcommands: [docker_start],
});

export const docker = branch({
  commandName: 'docker',
  description: 'Docker related commands',
  subcommands: [docker_start],
});

export const root = branch({
  commandName: 'rise-manager',
  description: `
    Manager your RISE node instance, including docker images.`,
  subcommands: [docker, node],
});

// if (require.main === module) {
//   cli(root)();
// }
