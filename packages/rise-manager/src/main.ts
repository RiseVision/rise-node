import { branch, cli, leaf, option } from '@carnesen/cli';
import { process as exec } from 'core-worker';
import { readFile } from 'fs';
import { isAbsolute } from 'path';
import { promisify } from 'util';

export const docker_start = leaf({
  commandName: 'start',
  description: 'Starts the container using a provided config',

  options: {
    config: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'config.json',
    }),
  },
  async action({ config }) {
    const result = await exec('docker-compose build; docker-compose up');
  },
});

export const docker = branch({
  commandName: 'docker',
  description: 'Docker-related commands',
  subcommands: [docker_start],
});

export const cat = leaf({
  commandName: 'cat',
  description: 'Print the contents of a file',
  options: {
    filePath: option({
      typeName: 'string',
      nullable: false,
      description: 'An absolute path',
      defaultValue: __filename,
      validate(value) {
        if (isAbsolute(value)) {
          return;
        }
        return 'File path must be absolute';
      },
    }),
  },
  async action({ filePath }) {
    const contents = await promisify(readFile)(filePath, { encoding: 'utf8' });
    return contents;
  },
});

// A "branch" command is a container for subcommands which can
// themselves be either "branch" commands or "leaf" commands
export const root = branch({
  commandName: 'rise-manager',
  description: `
    Manager your RISE node instance, including docker images.`,
  subcommands: [docker, cat],
});

if (require.main === module) {
  cli(root)();
}
