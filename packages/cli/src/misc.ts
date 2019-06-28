// tslint:disable:no-console
import { execSync } from 'child_process';
import * as debug from 'debug';
import * as fs from 'fs';
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
  const path = getNodeFilePath()
  if (!fs.existsSync(path)) {
    throw new Error(`File ${path} doesn't exist`);
  }

  console.log(`Extracting ${DOCKER_DIR}/${NODE_FILE}`);
  execSync(`cd ${getDockerDir()} && tar -zxf ${NODE_FILE}`);
}

/**
 * Returns the path to the lerna CLI file.
 */
export function getLernaFilePath(): string {
  return path.resolve(
    path.join(__dirname, NODE_DIR, 'node_modules', '.bin', 'lerna')
  );
}

/**
 * Returns the path to the rise-node.tar.gz file.
 */
export function getNodeFilePath(): string {
  return path.resolve(
    path.join(__dirname, DOCKER_DIR, NODE_FILE)
  );
}
