// tslint:disable:no-console
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  BACKUP_LOCK_FILE,
  BACKUPS_DIR,
  DOCKER_DIR,
  NODE_DIR,
  NODE_FILE,
  NODE_LOCK_FILE,
  NodeStates,
  TNetworkType,
} from './constants';
import { NoRiseDistFileError } from './exceptions';
import { execCmd, isDevEnv, log } from './misc';

export async function checkSourceDir(relativeToCLI = false) {
  const dirPath = relativeToCLI ? path.resolve(__dirname, NODE_DIR) : NODE_DIR;
  if (!fs.existsSync(dirPath) || !fs.lstatSync(dirPath).isDirectory()) {
    await extractSourceFile();
  }
}

export function checkLaunchpadExists(): boolean {
  const file = getLaunchpadFilePath();
  if (!fs.existsSync(file)) {
    log(`Missing: ${file}`);
    console.log(`ERROR: can't find launchpad executable in ${NODE_DIR}.`);
    console.log('You can download the latest version using:');
    console.log('  ./rise download');
    return false;
  }
  return true;
}

export function checkDockerDirExists(): boolean {
  if (!fs.existsSync(DOCKER_DIR) || !fs.lstatSync(DOCKER_DIR).isDirectory()) {
    console.log(`Error: directory '${DOCKER_DIR}' doesn't exist.`);
    console.log('You can download the latest version using:');
    console.log('  ./rise download');
    return false;
  }
  return true;
}

export function getDockerDir(relativeToCLI = false): string {
  const root = relativeToCLI ? __dirname : process.cwd();
  return path.resolve(root, DOCKER_DIR);
}

export function getNodeDir(relativeToCLI = false): string {
  const root = relativeToCLI ? __dirname : process.cwd();
  return path.resolve(root, NODE_DIR);
}

export async function extractSourceFile(
  relativeToCLI = false,
  streamOutput = false
) {
  const filePath = getSourceFilePath(relativeToCLI);
  if (!fs.existsSync(filePath)) {
    console.log(`ERROR: File ${DOCKER_DIR}/${NODE_FILE} missing`);
    console.log('You can download the latest version using:');
    console.log('  ./rise download');
    throw new NoRiseDistFileError();
  }

  console.log(`Extracting ${DOCKER_DIR}/${NODE_FILE}`);
  await execCmd(
    'tar',
    ['-zxf', NODE_FILE],
    `Couldn't extract ${getSourceFilePath(relativeToCLI)}`,
    {
      cwd: getDockerDir(relativeToCLI),
    },
    streamOutput
  );
}

/**
 * Returns the path to the lerna CLI file.
 */
export function getLaunchpadFilePath(): string {
  return path.resolve(
    process.cwd(),
    NODE_DIR,
    'node_modules',
    '.bin',
    'rise-launchpad'
  );
}

/**
 * Returns the path to a specific package.
 */
export function getPackagePath(packageName: string = null): string {
  return path.resolve(process.cwd(), NODE_DIR, 'packages', packageName);
}

/**
 * Returns the path to the rise-node.tar.gz file.
 */
export function getSourceFilePath(relativeToCLI = false): string {
  const root = relativeToCLI ? __dirname : process.cwd();
  return path.resolve(root, DOCKER_DIR, NODE_FILE);
}

export function getConfigPath(
  networkType: TNetworkType,
  relativeToCLI = false
): string {
  return path.resolve(
    getNodeDir(relativeToCLI),
    'packages',
    'rise',
    'etc',
    networkType,
    'config.json'
  );
}

export function getBackupsDir(): string {
  return path.resolve(process.cwd(), BACKUPS_DIR);
}

export function getCoreRiseDir(): string {
  return path.resolve(process.cwd(), NODE_DIR, 'packages', 'rise');
}

export function setBackupLock() {
  fs.writeFileSync(BACKUP_LOCK_FILE, process.pid);
}

export function removeBackupLock() {
  fs.unlinkSync(BACKUP_LOCK_FILE);
}

export function setNodeLock(pid: number, state: NodeStates) {
  log(`Creating lock file ${NODE_LOCK_FILE} (${pid})`);
  const data = [pid, state].join('\n');
  fs.writeFileSync(NODE_LOCK_FILE, data, { encoding: 'utf8' });
}

export function removeNodeLock() {
  if (!isDevEnv() && fs.existsSync(NODE_LOCK_FILE)) {
    fs.unlinkSync(NODE_LOCK_FILE);
  }
}

/**
 * Gets the PID from a PID lock file.
 *
 * Performs garbage collection if the process isn't running any more.
 *
 * @param filePath
 * @return [pid, state]
 */
export function getPID(filePath: string): [number, NodeStates] | false {
  try {
    const [pid, state] = fs
      .readFileSync(filePath, { encoding: 'utf8' })
      .split('\n');
    let exists: string;
    try {
      exists = execSync(`ps -p ${pid} -o pid=`).toString('utf8');
    } catch {
      // empty
    }
    if (!exists) {
      fs.unlinkSync(filePath);
      return false;
    }
    return [parseInt(pid, 10), state as NodeStates];
  } catch {
    // empty
  }
  return false;
}

/**
 * Returns the PID of currently running node.
 */
export function getNodePID(): number | false {
  try {
    return getPID(NODE_LOCK_FILE)[0];
  } catch {
    return false;
  }
}

export function getNodeState(): NodeStates | false {
  try {
    return getPID(NODE_LOCK_FILE)[1];
  } catch {
    return false;
  }
}

export function getBackupPID(): number | false {
  try {
    return getPID(NODE_LOCK_FILE)[0];
  } catch {
    return false;
  }
}
