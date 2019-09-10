// TODO read this from package.json ?
export const VERSION_CLI = 'v1.0.4';
export const VERSION_RISE = 'latest';
// TODO single enum for NETWORKS and NetworkType
export const NETWORKS = ['mainnet', 'testnet', 'devnet'];
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
export const DATA_DIR = 'data';
export const DB_DATA_DIR = DATA_DIR + '/db';
export const DB_LOG_FILE = DATA_DIR + '/db.log';
export const DB_LOCK_FILE = DB_DATA_DIR + '/postmaster.pid';
export const DB_PG_CTL =
  process.platform === 'linux' ? '/usr/lib/postgresql/11/bin/pg_ctl' : 'pg_ctl';
export const DOWNLOAD_URL = 'https://github.com/RiseVision/rise-node/releases/';
export const NODE_LOCK_FILE = '/tmp/rise-node.pid.lock';
export const BACKUP_LOCK_FILE = '/tmp/rise-backup.pid.lock';
export const BACKUPS_DIR = DATA_DIR + '/backups';
