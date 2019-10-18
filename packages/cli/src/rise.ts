// tslint:disable:no-console
import { branch, cli, leaf } from '@carnesen/cli';
import dot from 'dotenv';
import 'source-map-support/register';
import configDefaults from './config-default';
import dbCrontab from './db/crontab';
import dbInit from './db/init';
import dbInstall from './db/install';
import dbStart from './db/start';
import dbStop from './db/stop';
import dockerComposeStart from './docker-compose/start';
import dockerComposeStop from './docker-compose/stop';
import dockerBuild from './docker/build';
import dockerStart from './docker/start';
import dockerStop from './docker/stop';
import download from './download';
import migrate from './migrate';
import nodeCrontab from './node/crontab';
import nodeExportDB from './node/export-db';
import nodeExportSnapshot from './node/export-snapshot';
import nodeImportDB from './node/import-db';
import nodeInstallDeps from './node/install-deps';
import nodeKill from './node/kill';
import nodeLogs from './node/logs';
import nodeRebuildNative from './node/rebuild-native';
import nodeReset from './node/reset';
import nodeStart from './node/start';
import nodeStatus from './node/status';
import nodeStop from './node/stop';
import { VERSION_CLI } from './shared/constants';
import { log } from './shared/log';
import updateCli from './update-cli';

dot.config();

export const node = branch({
  commandName: 'node',
  description: 'RISE Node on the host OS',
  subcommands: [
    nodeStart,
    nodeStop,
    nodeStatus,
    nodeLogs,
    nodeExportDB,
    nodeImportDB,
    nodeExportSnapshot,
    nodeInstallDeps,
    nodeRebuildNative,
    nodeCrontab,
    nodeKill,
    nodeReset,
  ],
});

export const docker = branch({
  commandName: 'docker',
  description: 'RISE Node in Docker (experimental)',
  subcommands: [dockerStart, dockerStop, dockerBuild],
});

export const dockerCompose = branch({
  commandName: 'docker-compose',
  description: 'RISE Node and a DB in Docker (experimental)',
  subcommands: [dockerComposeStart, dockerComposeStop],
});

export const db = branch({
  commandName: 'db',
  description: 'Manage the local PostgreSQL database',
  subcommands: [dbInit, dbStart, dbStop, dbInstall, dbCrontab],
});

export const version = leaf({
  commandName: 'version',
  description: 'Version of the app',
  action() {
    log(VERSION_CLI);
  },
});

export const root = branch({
  commandName: 'rise',
  description: `
    Manage your RISE Node instance, including docker images.

    Every command provides --help.

    Usage:

    ./rise download
    ./rise update-cli

    # RISE Node on the host OS
    ./rise node start
    ./rise node stop
    ./rise node status
    ./rise node logs
    ./rise node export-db
    ./rise node import-db
    ./rise node export-snapshot
    ./rise node crontab
    ./rise node rebuild-native
    ./rise node install-deps
    ./rise node reset

    # RISE Node in Docker (experimental)
    ./rise docker build
    ./rise docker start
    ./rise docker stop

    # RISE Node and DB in Docker (experimental)
    ./rise docker-compose start
    ./rise docker-compose stop

    # local DB
    ./rise db install
    ./rise db init
    ./rise db start
    ./rise db stop
    ./rise db crontab

    # print config defaults
    ./rise config-defaults`,
  subcommands: [
    download,
    node,
    docker,
    dockerCompose,
    db,
    migrate,
    configDefaults,
    version,
    updateCli,
  ],
});

cli(root)();
