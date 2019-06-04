import * as dot from 'dotenv';
import { branch, cli, leaf } from '@carnesen/cli';
import dockerStart from './docker/start';
import dockerStop from './docker/stop';
import dockerDownload from './docker/download';
import nodeDownload from './node/download';
import nodeStart from './node/start';
import nodeRebuild from './node/rebuild_modules';
import { VERSION } from './misc';
dot.config();

export const node = branch({
  commandName: 'node',
  description: 'Node related commands',
  subcommands: [nodeStart, nodeDownload, nodeRebuild],
});

export const docker = branch({
  commandName: 'docker',
  description: 'Docker related commands',
  subcommands: [dockerStart, dockerDownload, dockerStop],
});

export const version = leaf({
  commandName: 'version',
  description: 'Version of the app',
  action() {
    console.log(VERSION);
  },
});

export const root = branch({
  commandName: 'rise',
  description: `
    Manage your RISE node instances, including docker images.

    Usage:
    
    ./rise node download
    ./rise node start
    ./rise node rebuild-native
    
    ./rise docker download
    ./rise docker start
    ./rise docker stop`,
  subcommands: [docker, node, version],
});

cli(root)();
