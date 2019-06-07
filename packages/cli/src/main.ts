import { branch, cli, leaf } from '@carnesen/cli';
import * as dot from 'dotenv';
import dockerComposeStart from './docker-compose/start';
import dockerComposeStop from './docker-compose/stop';
import dockerBuild from './docker/build';
import dockerDownload from './docker/download';
import dockerStart from './docker/start';
import dockerStop from './docker/stop';
import { VERSION } from './misc';
import nodeDownload from './node/download';
import nodeRebuild from './node/rebuild';
import nodeStart from './node/start';

dot.config();

export const node = branch({
  commandName: 'node',
  description: 'Running a node in the host OS',
  subcommands: [nodeStart, nodeDownload, nodeRebuild],
});

export const docker = branch({
  commandName: 'docker',
  description: 'Running a node in Docker',
  subcommands: [dockerStart, dockerDownload, dockerStop, dockerBuild],
});

export const dockerCompose = branch({
  commandName: 'docker-compose',
  description: 'Running the DB and a node in Docker',
  subcommands: [dockerComposeStart, dockerComposeStop],
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
    
    # running a node in the host OS
    ./rise node download
    ./rise node start
    ./rise node rebuild-native
    
    # running a node in Docker
    ./rise docker download
    ./rise docker build
    ./rise docker start
    ./rise docker stop
    
    # running the DB and a node in Docker
    ./rise docker-compose start
    ./rise docker-compose stop`,
  subcommands: [docker, node, version, dockerCompose],
});

cli(root)();
