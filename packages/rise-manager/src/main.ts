import { branch, cli } from '@carnesen/cli';
import { docker_start } from './docker';
import { node_download, node_start } from './node';

export const node = branch({
  commandName: 'node',
  description: 'Node related commands',
  subcommands: [node_start, node_download],
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
