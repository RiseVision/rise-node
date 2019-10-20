// tslint:disable:no-console
import { execSync } from 'child_process';
import { debug as createDebug } from 'debug';
import fs from 'fs';
import { sync as mkdirpSync } from 'mkdirp';
import { DATA_DIR, LOGS_DIR, SHELL_LOG_FILE } from './constants';
import { getSudoUsername, isSudo } from './misc';

export const debug = createDebug('rise-cli');

// open the shell log file (no IoC)
export const logHandler = createShellLogHandler();

function createShellLogHandler(): number {
  mkdirpSync(LOGS_DIR);
  const fd = fs.openSync(SHELL_LOG_FILE, 'a');
  appendHeader(fd);
  // fix perms when in sudo
  if (isSudo()) {
    execSync(`chown -R ${getSudoUsername()} ${DATA_DIR}`);
  }
  return fd;
}

export function log(...msg: string[]) {
  fs.writeSync(logHandler, msg.join('\n') + '\n');
  console.log(...msg);
}

export function closeLog() {
  // TODO doesnt seem to work
  fs.writeSync(logHandler, '\n\n');
  fs.closeSync(logHandler);
}

function appendHeader(fd: number) {
  const header = [
    '-'.repeat(10),
    Date().toString(),
    process.argv.join(' '),
    '-'.repeat(10),
  ];

  fs.writeSync(fd, header.join('\n') + '\n\n\n');
}
