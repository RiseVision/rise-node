// tslint:disable:no-console
// tslint:disable:max-classes-per-file
import * as assert from 'assert';
import { execSync, spawn, SpawnOptions } from 'child_process';
import * as debug from 'debug';
import * as extend from 'extend';
import * as fs from 'fs';
import * as path from 'path';
import { IForeground, IVerbose } from './options';

export const VERSION_CLI = 'v1.0.0';
export const VERSION_RISE = 'latest';

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
export const DB_PG_CTL =
  process.platform === 'linux' ? '/usr/lib/postgresql/11/bin/pg_ctl' : 'pg_ctl';

export const DOWNLOAD_URL = 'https://github.com/RiseVision/rise-node/releases/';
export const NODE_LOCK_FILE = '/tmp/rise-node.pid.lock';
export const BACKUP_LOCK_FILE = '/tmp/rise-backup.pid.lock';
export const BACKUPS_DIR = DATA_DIR + '/backups';

export function getDownloadURL(file: string, version = VERSION_RISE) {
  return DOWNLOAD_URL + version + '/download/' + file;
}

export function isDevEnv() {
  return process.env.DEV;
}

export function getDockerDir(relativeToCLI = false): string {
  const root = relativeToCLI ? __dirname : process.cwd();
  return path.resolve(root, DOCKER_DIR);
}

export function getNodeDir(relativeToCLI = false): string {
  const root = relativeToCLI ? __dirname : process.cwd();
  return path.resolve(root, NODE_DIR);
}

/**
 * TODO unify with extractSourceFile
 * @param silent
 * @param relativeToCLI
 */
export function checkNodeDirExists(
  silent = false,
  relativeToCLI = false
): boolean {
  const dirPath = relativeToCLI ? path.resolve(__dirname, NODE_DIR) : NODE_DIR;
  if (!fs.existsSync(dirPath) || !fs.lstatSync(dirPath).isDirectory()) {
    if (!silent) {
      console.log(`Error: directory '${dirPath}' doesn't exist.`);
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
    log(`Missing: ${file}`);
    console.log(`ERROR: can't find launchpad executable in ${NODE_DIR}.`);
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

export async function extractSourceFile(
  relativeToCLI = false,
  streamOutput = false
) {
  const filePath = getSourceFilePath(relativeToCLI);
  if (!fs.existsSync(filePath)) {
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
 * Returns the path to the rise-node.tar.gz file.
 */
export function getSourceFilePath(relativeToCLI = false): string {
  const root = relativeToCLI ? __dirname : process.cwd();
  return path.resolve(root, DOCKER_DIR, NODE_FILE);
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

/**
 * Returns a merged config (user's + network's).
 */
export function mergeConfig(
  networkType: TNetworkType,
  configPath?: string | null,
  relativeToCLI = false
): INodeConfig {
  checkNodeDirExists(false, relativeToCLI);
  const parentConfigPath = getConfigPath(networkType, relativeToCLI);
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

// tslint:disable-next-line:cognitive-complexity
export function execCmd(
  file: string,
  params: string[],
  errorMsg?: string | null,
  options?: SpawnOptions,
  streamOutput = false,
  timeout?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const cmd = file + ' ' + params.join(' ');
      let output = '';
      let errors = '';
      // run the command
      const proc = spawn(file, params, {
        shell: true,
        ...options,
      });
      log(`$ ${cmd}`);
      // timeout
      const timer = timeout
        ? setTimeout(() => {
            if (!proc.killed) {
              console.log(`Timeout (${2 * MIN} secs)`);
              proc.kill();
            }
          }, timeout)
        : null;
      const appendOutput = (data: Buffer) => {
        if (streamOutput) {
          process.stdout.write(data);
        }
        output += data.toString('utf8');
      };
      proc.stdout.on('data', appendOutput);
      proc.stderr.on('data', appendOutput);
      proc.on('error', (error) => {
        // TODO reject only in 'close' listener
        reject(error);
      });
      proc.stderr.on('data', (data: Buffer) => {
        errors += data.toString('utf8');
      });
      errorMsg = errorMsg || `Command '${cmd}' failed`;
      proc.on('close', (code) => {
        if (code) {
          errors = errors.replace(/\n+$/, '');
          if (timeout) {
            clearTimeout(timer);
          }
          log(`cmd-error: ${errors}`);
          log(`cmd-exit-code: ${code}`);
          if (errors) {
            log(errors);
          }
          console.log('ERROR: ' + errorMsg);
          // TODO Error instance and include the original error msg
          reject(errorMsg);
        } else {
          resolve(output);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Returns a function resolving once "Blockchain ready" was printed.
 *
 * Detects errors and passed to reject():
 * - NativeModulesError
 * - DBConnectionError
 */
export function createParseNodeOutput(
  { foreground, verbose }: IForeground & IVerbose,
  setReady: () => void,
  resolve: (val?: any) => void,
  reject: (err?: Error) => void
): (data: Buffer) => void {
  return (data: Buffer) => {
    // output
    if (foreground || verbose) {
      process.stdout.write(data);
    } else {
      log(data);
    }
    // check if the output reached the desired line
    if (data.includes('Blockchain ready')) {
      console.log('Blockchain ready');
      setReady();
      // keep streaming the output if in the foreground
      if (!foreground) {
        resolve();
      }
    }
    // handle native modules errors
    if (
      data.includes('Error: dlopen') ||
      data.includes('Error: Could not locate the bindings file') ||
      data.includes('invalid ELF header')
    ) {
      log('NativeModulesError');
      reject(new NativeModulesError());
      return;
    }
    // handle address in use error
    if (data.includes('EADDRINUSE')) {
      log('AddressInUseError');
      reject(new AddressInUseError());
      return;
    }
    const sqlError = /Sequelize(\w*)Error/;
    if (sqlError.test(data.toString('utf8'))) {
      log('DBConnectionError');
      reject(new DBConnectionError());
      return;
    }
  };
}

export class NativeModulesError extends Error {
  constructor() {
    super('Native modules need rebuilding');
  }
}

export class AddressInUseError extends Error {
  constructor() {
    super('Address in use');
  }
}

export class DBConnectionError extends Error {
  constructor() {
    super("Couldn't connect to the DB");
  }
}

export class NoRiseDistFileError extends Error {
  constructor() {
    super(
      'ERROR: rise source missing.\n' +
        'You can download the latest version using:\n' +
        '  ./rise node download'
    );
  }
}

export function getCoreRiseDir(): string {
  return path.resolve(process.cwd(), NODE_DIR, 'packages', 'rise');
}

export function getDBEnvVars(
  network: TNetworkType,
  config: string | null,
  relativeToCLI = false
): IDBEnvVars {
  const mergedConfig = mergeConfig(network, config, relativeToCLI);
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

export interface IDBEnvVars {
  PGDATABASE: string;
  PGHOST: string;
  PGPASSWORD: string;
  PGPORT: string;
  PGUSER: string;
}

export function dbConnectionInfo(vars: IDBEnvVars): string {
  return [
    `Host: ${vars.PGHOST}`,
    `Port: ${vars.PGPORT}`,
    `User: ${vars.PGUSER}`,
    `DB: ${vars.PGDATABASE}`,
  ].join('\n');
}

export function printUsingConfig(network: TNetworkType, config: string | null) {
  if (config) {
    console.log(
      `Config: using "${config}" and inheriting from network "${network}".`
    );
  } else {
    console.log(`Config: default config for network "${network}".`);
  }
}

export class ConditionsNotMetError extends Error {
  public name = 'ErrorCmdConditionsNotMet';
}

export async function getBlockHeight(
  network: TNetworkType,
  config?: string,
  streamOutput = false
): Promise<number | null> {
  const envVars = getDBEnvVars(network, config);
  // TODO check output
  const output = await execCmd(
    'psql',
    [
      '-d',
      envVars.PGDATABASE,
      '-t',
      '-c',
      '"select height from blocks order by height desc limit 1;"',
    ],
    "Couldn't get the block height",
    {
      env: { ...process.env, ...envVars },
    },
    streamOutput
  );
  const blockHeight = parseInt(output, 10);
  log(`block height: ${blockHeight}`);
  return blockHeight || null;
}

export function unlinkLockFile() {
  if (!isDevEnv() && fs.existsSync(NODE_LOCK_FILE)) {
    fs.unlinkSync(NODE_LOCK_FILE);
  }
}
