// tslint:disable:no-console
import { execSync } from 'child_process';
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

export const DOCKER_DIR = 'rise-docker';
export const DIST_FILE = 'rise-docker.tar.gz';

// TODO update
export const NODE_DIR = `${DOCKER_DIR}/rise-node`;
export const NODE_FILE = 'rise-node.tar.gz';

export const DOWNLOAD_URL =
  'https://github.com/RiseVision/rise-node/releases/download/';
export const LOCK_FILE = '/tmp/rise-node.pid.lock';
export const BACKUP_LOCK_FILE = '/tmp/rise-backup.lock';
export const BACKUPS_DIR = 'data/backups';

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

export function checkLernaExists(): boolean {
  const file = getLernaFilePath();
  if (!fs.existsSync(file)) {
    console.log(
      `Error: can't find lerna executable in ${DOCKER_DIR}/${NODE_DIR}.`
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

export function extractRiseNodeFile() {
  const filePath = getNodeFilePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} doesn't exist`);
  }

  console.log(`Extracting ${DOCKER_DIR}/${NODE_FILE}`);
  execSync(`cd ${getDockerDir()} && tar -zxf ${NODE_FILE}`);
}

/**
 * Returns the path to the lerna CLI file.
 */
export function getLernaFilePath(): string {
  return path.resolve(
    path.join(process.cwd(), NODE_DIR, 'node_modules', '.bin', 'lerna')
  );
}

/**
 * Returns the path to the rise-node.tar.gz file.
 */
export function getNodeFilePath(): string {
  return path.resolve(path.join(process.cwd(), DOCKER_DIR, NODE_FILE));
}

/**
 * Returns the PID of currently running node.
 *
 * Performs garbage collection if the process isn't running any more.
 */
export function getPID(): string | false {
  try {
    const pid = fs.readFileSync(LOCK_FILE, { encoding: 'utf8' });
    const exists = execSync(`ps -p ${pid} -o pid=`);
    if (!exists) {
      fs.unlinkSync(LOCK_FILE);
      return false;
    }
    return pid;
  } catch {
    // empty
  }
  return false;
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
export interface IConfig {
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

/**
 * Returns a merged config (user's + network's).
 */
export function mergeConfig(
  configPath: string,
  networtType: TNetworkType
): IConfig {
  checkNodeDirExists();
  const parentConfigPath = path.resolve(
    getNodeDir(),
    'packages',
    'rise',
    'etc',
    networtType,
    'config.json'
  );
  if (!fs.existsSync(parentConfigPath)) {
    throw new Error(`Parent config ${parentConfigPath} doesn't exist`);
  }
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config ${configPath} doesn't exist`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }));
  const parentConfig = JSON.parse(
    fs.readFileSync(parentConfigPath, { encoding: 'utf8' })
  );
  return extend(true, parentConfig, config);
}

export function getBackupsDir(): string {
  return path.resolve(process.cwd(), BACKUPS_DIR);
}

export function getBackupLockFile(): string {
  return path.resolve(process.cwd(), BACKUP_LOCK_FILE);
}

export function execCmd(
  cmd: string,
  errorMsg?: string | null,
  envVars?: { [name: string]: string }
): string {
  errorMsg = errorMsg || `Command '${cmd} failed`;
  try {
    log(`$ ${cmd}`);
    return execSync(cmd, {
      env: { ...process.env, ...envVars },
    }).toString('utf8');
  } catch (err) {
    log(err);
    console.log(errorMsg);
    throw err;
  }
}
