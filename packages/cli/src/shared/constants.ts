const isLinux = process.platform === 'linux';
// TODO keep in sync with /packages/cli/package.json
export const VERSION_CLI = 'v1.1.9';
// TODO keep in sync with /package.json
export const VERSION_RISE = 'v2.0.1-beta2';
// TODO single enum for NETWORKS and NetworkType
export const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const;
export type TNetworkType = 'mainnet' | 'testnet' | 'devnet';
export const SEC = 1000;
export const MIN = 60 * SEC;
export const DOCKER_DIR = 'rise-node';
export const DIST_FILE = 'rise-node.tar.gz';
export const DOCKER_IMAGE_NAME = 'rise-local-node';
export const DOCKER_CONTAINER_NAME = 'rise-node';
export const DOCKER_CONFIG_FILE = DOCKER_DIR + '/config-docker.json';
export const NODE_DIR = `${DOCKER_DIR}/source`;
/** Not a root-relative path */
export const NODE_FILE = 'source.tar.gz';
export const POSTGRES_HOME = '/var/lib/postgresql/';
export const DATA_DIR = 'data';
export const DB_DATA_DIR = isLinux
  ? POSTGRES_HOME + DATA_DIR + '/db'
  : DATA_DIR + '/db';
export const DB_LOG_FILE = isLinux
  ? POSTGRES_HOME + DATA_DIR + '/db.log'
  : DATA_DIR + '/db.log';
export const DB_LOCK_FILE = DB_DATA_DIR + '/postmaster.pid';
export const DB_PG_PATH = isLinux ? '/usr/lib/postgresql/11/bin/' : '';
export const DOWNLOAD_URL = 'https://github.com/RiseVision/rise-node/releases/';
export const NODE_LOCK_FILE = '/tmp/rise-node-v2.pid.lock';
export const SNAPSHOT_LOCK_FILE = '/tmp/rise-snapshot-v2.pid.lock';
export const BACKUP_LOCK_FILE = '/tmp/rise-backup-v2.pid.lock';
export const BACKUPS_DIR = DATA_DIR + '/backups';
export const LOGS_DIR = DATA_DIR + '/logs';
export const SHELL_LOG_FILE = LOGS_DIR + '/shell';
export const V1_CONFIG_FILE = 'etc/node_config.json';

export enum NodeStates {
  STARTING = 'starting',
  READY = 'ready',
}
