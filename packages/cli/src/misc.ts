import * as debug from 'debug';
import * as path from 'path';

export const VERSION = 'v1.0.0';
export const NODE_VERSION = 'v2.0.0-beta2';

export const NETWORKS = ['mainnet', 'testnet', 'devnet'];

export const SEC = 1000;
export const MIN = 60 * SEC;
export const log = debug('rise-cli');

export const NODE_DIR = 'rise-docker/rise-node';
export const NODE_FILE = 'rise-node.tar.gz';

export const DOCKER_DIR = 'rise-docker';
export const DOCKER_URL =
  'https://github.com/RiseVision/rise-node-priv/releases/download/';
export const DOCKER_FILE = 'rise-docker.tar.gz';

export function isDevEnd() {
  return process.env.DEV;
}

export function getDockerDir(): string {
  return path.resolve(__dirname, DOCKER_DIR);
}

export function getNodeDir(): string {
  return path.resolve(__dirname, DOCKER_DIR);
}
