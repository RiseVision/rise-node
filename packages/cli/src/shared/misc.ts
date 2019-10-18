// tslint:disable:no-console
import assert from 'assert';
import { execSync, spawn, SpawnOptions } from 'child_process';
import extend from 'extend';
import fs from 'fs';
import path from 'path';
import {
  DOWNLOAD_URL,
  NODE_DIR,
  TNetworkType,
  VERSION_RISE,
} from './constants';
import {
  AddressInUseError,
  ConditionsNotMetError,
  DBConnectionError,
  DBCorruptedError,
  DBNotInstalledError,
  NativeModulesError,
} from './exceptions';
import { getConfigPath } from './fs-ops';
import { debug, log } from './log';
import { IForeground, IVerbose } from './options';

export function getDownloadURL(file: string, version = VERSION_RISE) {
  return DOWNLOAD_URL + version + '/download/' + file;
}

export function isDevEnv() {
  return process.env.DEV;
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
  consoleLogLevel: 'info' | 'debug' | 'error';
  logFileName: string;
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  address: string;
  api: {
    port: number;
  };
}

/**
 * Returns a merged config (user's + network's).
 */
export function mergeConfig(
  networkType: TNetworkType,
  configPath?: string | null,
  relativeToCLI = false
): INodeConfig {
  const root = relativeToCLI ? __dirname : process.cwd();
  if (!fs.existsSync(path.resolve(root, NODE_DIR))) {
    throw new Error(`${NODE_DIR} missing`);
  }
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
    // TODO ideally print errors from exceptions in one place
    log(`Config ${configPath} doesn't exist`);
    throw new Error(`Config ${configPath} doesn't exist`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }));
  return extend(true, parentConfig, config);
}

/**
 * TODO support `sudo -u USERNAME CMD` when in `isSudo()`
 *   will cause problems with pipes
 */
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
      debug(`$ ${cmd}`);
      if (streamOutput) {
        log(`$ ${cmd}`);
      }
      // timeout
      const timer = timeout
        ? setTimeout(() => {
            if (!proc.killed) {
              log(`Timeout (${timeout} secs)`);
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
      proc.on('error', (error: Error) => {
        reject(error);
      });
      proc.stderr.on('data', (data: Buffer) => {
        errors += data.toString('utf8');
      });
      errorMsg = errorMsg || `Command '${cmd}' failed`;
      proc.on('close', (code) => {
        if (timeout) {
          clearTimeout(timer);
        }
        if (code) {
          errors = errors.replace(/\n+$/, '');
          debug(`cmd-error: ${errors}`);
          debug(`cmd-exit-code: ${code}`);
          if (errors) {
            debug(errors);
          }
          log('ERROR: ' + errorMsg);
          if (errorMsg.includes('psql: not found')) {
            reject(new DBNotInstalledError());
          } else {
            reject(new Error(errorMsg));
          }
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
      debug(data.toString('utf8'));
    }
    // check if the output reached the desired line
    if (data.includes('Blockchain ready')) {
      log('Blockchain ready');
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
      debug('NativeModulesError');
      reject(new NativeModulesError());
      return;
    }
    // handle address in use error
    if (data.includes('EADDRINUSE')) {
      debug('AddressInUseError');
      reject(new AddressInUseError());
      return;
    }
    // DB corrupted
    if (data.includes('SequelizeUniqueConstraintError')) {
      debug('DBCorruptedError');
      reject(new DBCorruptedError());
      return;
    }
    // DB connection failed (catch all errors from Sequelize)
    const sqlError = /Sequelize(\w*)Error/;
    if (sqlError.test(data.toString('utf8'))) {
      debug('DBConnectionError');
      reject(new DBConnectionError());
      return;
    }
  };
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
    log(`Config: using "${config}" and inheriting from network "${network}".`);
  } else {
    log(`Config: default config for network "${network}".`);
  }
}

export async function getBlockHeight(
  network: TNetworkType,
  config?: string,
  streamOutput = false,
  targetDB?: string
): Promise<number | null> {
  const output = await runSQL(
    'select height from blocks order by height desc limit 1;',
    network,
    config,
    streamOutput,
    targetDB
  );
  const blockHeight = parseInt(output, 10);
  debug(`block height: ${blockHeight}`);
  return blockHeight || null;
}

export async function runSQL(
  query: string,
  network: TNetworkType,
  config?: string,
  streamOutput = false,
  database?: string
): Promise<string> {
  const envVars = getDBEnvVars(network, config);
  const escaped = query.replace(/"/g, '\\"');
  return await execCmd(
    'psql',
    ['-d', database || envVars.PGDATABASE, '-t', '-c', `"${escaped}"`],
    'SQL query failed',
    {
      env: { ...process.env, ...envVars },
    },
    streamOutput
  );
}

export function isLinux() {
  return process.platform === 'linux';
}

export function isSudo() {
  const uid = execSync('id -u').toString('utf8');
  return uid === '0';
}

export function assertV1Dir() {
  if (!fs.existsSync('manager.sh')) {
    throw new ConditionsNotMetError('Not in the V1 directory');
  }
}

/**
 * Returns the name of the current user even if the CLI has been ran with sudo.
 */
export async function sudoUsername(verbose = false): Promise<string> {
  return await execCmd(
    'logname',
    null,
    "Couldn't get the username from before sudo",
    null,
    verbose
  );
}
