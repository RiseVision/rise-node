// tslint:disable:no-console
import * as assert from 'assert';
import { execSync, ExecSyncOptions } from 'child_process';
import * as debug from 'debug';
import * as extend from 'extend';
import * as fs from 'fs';
import * as path from 'path';

export const VERSION = 'v1.0.0';
export const NODE_VERSION = 'v2.0.0-beta2';

// TODO single enum for NETWORKS and NetworkType
export const NETWORKS = ['mainnet', 'testnet', 'devnet'];
export type TNetworkType = 'mainnet' | 'testnet' | 'devnet';

export const SEC = 1000;
export const MIN = 60 * SEC;
export const log = debug('rise-cli');

export const DOCKER_DIR = 'rise-node';
export const DIST_FILE = 'rise-node.tar.gz';
export const DOCKER_IMAGE_NAME = 'rise-local-node';
export const DOCKER_CONTAINER_NAME = 'rise-node';
export const DOCKER_CONFIG_FILE = DOCKER_DIR + '/config-docker.json';

export const NODE_DIR = `${DOCKER_DIR}/source`;
export const NODE_FILE = 'source.tar.gz';
export const DATA_DIR = 'data';
export const DB_DATA_DIR = DATA_DIR + '/db';
export const DB_LOG_FILE = DATA_DIR + '/db.log';
export const DB_LOCK_FILE = DB_DATA_DIR + '/postmaster.pid';

export const DOWNLOAD_URL =
  'https://github.com/RiseVision/rise-node/releases/download/';
export const NODE_LOCK_FILE = '/tmp/rise-node.pid.lock';
export const BACKUP_LOCK_FILE = '/tmp/rise-backup.pid.lock';
export const BACKUPS_DIR = DATA_DIR + '/backups';

export function isDevEnv() {
  return process.env.DEV;
}

export function getDockerDir(): string {
  return path.resolve(process.cwd(), DOCKER_DIR);
}

export function getNodeDir(): string {
  return path.resolve(process.cwd(), NODE_DIR);
}

export function checkNodeDirExists(silent = false): boolean {
  if (!fs.existsSync(NODE_DIR) || !fs.lstatSync(NODE_DIR).isDirectory()) {
    if (!silent) {
      console.log(`Error: directory '${NODE_DIR}' doesn't exist.`);
      console.log('You can download the latest version using:');
      console.log('  ./rise node download');
    }
    return false;
  }
  return true;
}

export function checkLaunchpadExists(): boolean {
  const file = getLaunchpadFilePath();
  if (!fs.existsSync(file)) {
    console.log(
      `ERROR: can't find lerna executable in ${DOCKER_DIR}/${NODE_DIR}.`
    );
    console.log('You can download the latest version using:');
    console.log('  ./rise node download');
    return false;
  }
  return true;
}

export function checkDockerDirExists(): boolean {
  if (!fs.existsSync(DOCKER_DIR) || !fs.lstatSync(DOCKER_DIR).isDirectory()) {
    console.log(`Error: directory '${DOCKER_DIR}' doesn't exist.`);
    console.log('You can download the latest version using:');
    console.log('  ./rise docker download');
    return false;
  }
  return true;
}

export function extractSourceFile() {
  const filePath = getSourceFilePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} doesn't exist`);
  }

  console.log(`Extracting ${DOCKER_DIR}/${NODE_FILE}`);
  execCmd(
    `cd ${getDockerDir()} && tar -zxf ${NODE_FILE}`,
    `Couldn't extract ${getSourceFilePath()}`
  );
}

/**
 * Returns the path to the lerna CLI file.
 */
export function getLaunchpadFilePath(): string {
  return path.resolve(
    path.join(process.cwd(), NODE_DIR, 'node_modules', '.bin', 'rise-launchpad')
  );
}

/**
 * Returns the path to the rise-node.tar.gz file.
 */
export function getSourceFilePath(): string {
  return path.resolve(path.join(process.cwd(), DOCKER_DIR, NODE_FILE));
}

/**
 * Gets the PID from a PID lock file.
 *
 * Performs garbage collection if the process isn't running any more.
 *
 * @param filePath
 */
export function getPID(filePath: string): number | false {
  try {
    const pid = fs.readFileSync(filePath, { encoding: 'utf8' }).split('\n')[0];
    let exists: string;
    try {
      exists = execSync(`ps -p ${pid} -o pid=`).toString('utf8');
    } catch {
      // empty
    }
    if (!exists) {
      fs.unlinkSync(NODE_LOCK_FILE);
      return false;
    }
    return parseInt(pid, 10);
  } catch {
    // empty
  }
  return false;
}

/**
 * Returns the PID of currently running node.
 */
export function getNodePID(): number | false {
  return getPID(NODE_LOCK_FILE);
}

export function getBackupPID(): number | false {
  return getPID(BACKUP_LOCK_FILE);
}

/**
 * Checks if Postgres tools are intalled and runnable.
 */
export function hasLocalPostgres(): boolean {
  const toCheck = ['dropdb', 'vacuumdb', 'createdb', 'pg_dump', 'psql'];
  try {
    for (const file of toCheck) {
      execSync(`which ${file}`);
    }
  } catch {
    return false;
  }
  return true;
}

// TODO only a partial config, ideally import from /packages/core
export interface INodeConfig {
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export function getConfigPath(networkType: TNetworkType): string {
  return path.resolve(
    getNodeDir(),
    'packages',
    'rise',
    'etc',
    networkType,
    'config.json'
  );
}

/**
 * Returns a merged config (user's + network's).
 */
export function mergeConfig(
  networkType: TNetworkType,
  configPath?: string | null
): INodeConfig {
  checkNodeDirExists();
  const parentConfigPath = getConfigPath(networkType);
  if (!fs.existsSync(parentConfigPath)) {
    throw new Error(`Parent config ${parentConfigPath} doesn't exist`);
  }
  const parentConfig = JSON.parse(
    fs.readFileSync(parentConfigPath, { encoding: 'utf8' })
  );
  // return only the parent config
  if (!configPath) {
    return parentConfig;
  }
  // merge the passed config
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config ${configPath} doesn't exist`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }));
  return extend(true, parentConfig, config);
}

export function getBackupsDir(): string {
  return path.resolve(process.cwd(), BACKUPS_DIR);
}

export function setBackupLock() {
  fs.writeFileSync(BACKUP_LOCK_FILE, process.pid);
}

export function removeBackupLock() {
  fs.unlinkSync(BACKUP_LOCK_FILE);
}

export function execCmd(
  cmd: string,
  errorMsg?: string | null,
  envVars?: { [name: string]: string } | null,
  options?: ExecSyncOptions
): string {
  errorMsg = errorMsg || `Command '${cmd} failed`;
  try {
    log(`$ ${cmd}`);
    return execSync(cmd, {
      env: { ...process.env, ...envVars },
      ...options,
    }).toString('utf8');
  } catch (err) {
    log(err);
    console.log('ERROR: ' + errorMsg);
    throw err;
  }
}

/**
 * Returns a function resolving once "Blockchain ready" was printed.
 * @param params
 * @param setReady
 * @param resolve
 */
export function createWaitForReady(
  params: { foreground: boolean; showLogs: boolean },
  setReady: () => void,
  resolve: (val?: any) => void
) {
  return (data: string) => {
    // output
    if (params.showLogs) {
      process.stdout.write(data);
    } else {
      log(data);
    }
    // check if the output reached the desired line
    if (data.includes('Blockchain ready')) {
      console.log('Blockchain ready');
      setReady();
      // keep streaming the output if in the foreground
      if (!params.foreground) {
        resolve();
      }
    }
  };
}

export function getCoreRiseDir(): string {
  return path.resolve(process.cwd(), NODE_DIR, 'packages', 'rise');
}

export const cmdSilenceString = '>> /dev/null 2>&1';

export function getDBVars(network: TNetworkType, config: string | null) {
  const mergedConfig = mergeConfig(network, config);
  const { host, port, database, user, password } = mergedConfig.db;
  assert(host);
  assert(port);
  assert(database);
  assert(password);

  return {
    PGDATABASE: database,
    PGHOST: host,
    PGPASSWORD: password,
    PGPORT: port.toString(),
    PGUSER: user,
  };
}

export function printUsingConfig(network: TNetworkType, config: string | null) {
  if (config) {
    console.log(
      `Using the config from ./${config} and inheriting from network "${network}".`
    );
  } else {
    console.log(`Using the default config for network "${network}".`);
  }
}
