import * as debug from 'debug';

export const VERSION = 'v1.0.0';

export const SEC = 1000;
export const MIN = 60 * SEC;
export const log = debug('rise-cli');

export const NODE_DIR = 'rise-node';
export const NODE_URL =
  'https://github.com/RiseVision/rise-node-priv/releases/';
export const NODE_FILE = 'rise-node.tar.gz';

export const DOCKER_DIR = 'rise-docker';
export const DOCKER_URL =
  'https://github.com/RiseVision/rise-node-priv/releases/';
export const DOCKER_FILE = 'rise-docker.tar.gz';

export function isDevEnd() {
  return process.env.DEV;
}
