// tslint:disable:no-console
import { branch, cli, leaf } from '@carnesen/cli';
import * as dot from 'dotenv';
import configDefaults from './config-default';
import dockerComposeStart from './docker-compose/start';
import dockerComposeStop from './docker-compose/stop';
import dockerBuild from './docker/build';
import dockerStart from './docker/start';
import dockerStop from './docker/stop';
import download from './download';
import { VERSION } from './shared/misc';
import exportDB from './node/export-db';
import nodeRebuild from './node/rebuild';
import nodeStart from './node/start';
import nodeStop from './node/stop';

dot.config();

export const node = branch({
  commandName: 'node',
  description: 'Node running on the host OS',
  subcommands: [nodeStart, nodeRebuild, nodeStop, exportDB],
});

export const docker = branch({
  commandName: 'docker',
  description: 'Node running in Docker',
  subcommands: [dockerStart, dockerStop, dockerBuild],
});

export const dockerCompose = branch({
  commandName: 'docker-compose',
  description: 'Node and DB running in Docker',
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
    Manage your RISE node instance, including docker images.

    Usage:

    ./rise download

    # running a node in the host OS
    ./rise node start
    ./rise node stop
    ./rise node rebuild-native
    ./rise node export-db

    # running a node in Docker
    ./rise docker build
    ./rise docker start
    ./rise docker stop

    # running the DB and a node in Docker
    ./rise docker-compose start
    ./rise docker-compose stop

    # printing config defaults
    ./rise config-defaults`,
  subcommands: [download, node, docker, dockerCompose, configDefaults, version],
});

cli(root)();
