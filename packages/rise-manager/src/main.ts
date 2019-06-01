import { branch, cli } from '@carnesen/cli';
import { docker_download, docker_start } from './docker';
import { node_download, node_start } from './node';

export const node = branch({
  commandName: 'node',
  description: 'Node related commands',
  subcommands: [node_start, node_download],
});

export const docker = branch({
  commandName: 'docker',
  description: 'Docker related commands',
  subcommands: [docker_start, docker_download],
});

export const root = branch({
  commandName: 'rise-manager',
  description: `
    Manager your RISE node instance, including docker images.

    Usage:
    
    ./rise node download
    ./rise node start
    
    ./rise docker download
    ./rise docker start`,
  subcommands: [docker, node],
});

cli(root)();
